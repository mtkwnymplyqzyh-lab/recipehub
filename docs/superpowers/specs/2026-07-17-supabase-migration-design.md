# תכנון: מעבר RecipeHub מ-Firebase ל-Supabase

**תאריך:** 2026-07-17
**סטטוס:** מאושר ע"י דניאל

## רקע והחלטות

- מעבר מלא: Auth + נתונים + תמונות. Firebase נמחק לגמרי.
- מתחילים נקי — אין מיגרציית נתונים מ-Firestore.
- תמונות ב-Supabase Storage (פותר את באג ה-Base64 שחרג ממגבלת המסמך).
- ארכיטקטורה: שכבת נתונים מרוכזת (`src/lib/api.ts`) — הדפים לא ניגשים ל-DB ישירות.
- אין עדיין פרויקט Supabase — יצירתו היא שלב 1 בביצוע.

## 1. סכמת טבלאות (Postgres)

```sql
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  photo_url text,
  bio text CHECK (bio IS NULL OR char_length(bio) < 500),
  created_at timestamptz NOT NULL DEFAULT now()
)

recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (char_length(description) < 2000),
  prep_time int NOT NULL CHECK (prep_time >= 1),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 100),
  cuisine text CHECK (cuisine IS NULL OR char_length(cuisine) <= 100),
  secret_tip text CHECK (secret_tip IS NULL OR char_length(secret_tip) <= 1000),
  image_url text,
  is_public boolean NOT NULL DEFAULT true,
  ingredients jsonb NOT NULL,      -- [{name, amount, unit}], 1–100 פריטים
  instructions jsonb NOT NULL,     -- [string], 1–50 פריטים
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

favorites (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
)
```

אינדקסים: `recipes(is_public, created_at desc)`, `recipes(author_id)`, `recipes(category)`.

### מה זה מחליף

- **ספירת לייקים:** אין שדה `likesCount`. הספירה נעשית עם `count` על `favorites` בשאילתה. אין race conditions ואין צורך בטרנזקציית ±1.
- **מחיקת מתכון:** `ON DELETE CASCADE` מנקה מועדפים אוטומטית — אין רשומות יתומות.
- **יצירת פרופיל:** trigger על `auth.users` (INSERT) יוצר שורת `profiles` עם `display_name` ו-`photo_url` מה-metadata של Google. מחליף את הלוגיקה שהייתה ב-`AuthContext` (ומתקן את באג הספינר האינסופי בכשל רשת).

## 2. הרשאות (RLS)

RLS מופעל על כל הטבלאות. מדיניות:

| טבלה | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | כולם (מחוברים) | — (trigger בלבד) | רק עצמך | — |
| recipes | `is_public` או המחבר | מחובר, `author_id = auth.uid()` | רק המחבר | רק המחבר |
| favorites | רק שלך | רק שלך | — | רק שלך |

ולידציות תוכן (אורכים, טווחים) — ב-CHECK constraints בטבלאות + ולידציה בצד לקוח לחוויית משתמש.

## 3. Auth

- Supabase Auth עם ספק Google OAuth (חוויית התחברות זהה להיום).
- `AuthContext` שומר על אותו ממשק ציבורי: `user`, `profile`, `loading`, `signIn`, `logout`. רק המימוש מתחלף (`supabase.auth.onAuthStateChange`, `signInWithOAuth`).
- כשל בטעינת פרופיל לא תוקע את מסך הטעינה (`finally`).

## 4. תמונות — Supabase Storage

- Bucket ציבורי בשם `recipe-images`.
- נתיב העלאה: `{userId}/{uuid}.{ext}`; מדיניות Storage: כתיבה/מחיקה רק לתיקייה של עצמך, קריאה לכולם.
- מגבלת גודל בצד לקוח: 5MB. בטבלה נשמר URL בלבד.
- הדבקת URL חיצוני לתמונה נשארת כאופציה.

## 5. מבנה קוד

```
src/lib/supabase.ts   — יצירת client מ-env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
src/lib/api.ts        — כל פונקציות הנתונים, מוקלדות במלואן:
                        getRecipes(category?), getRecipe(id), getUserRecipes(userId, isOwner),
                        createRecipe, updateRecipe, deleteRecipe,
                        isFavorite, toggleFavorite, getFavoriteRecipes,
                        getProfile, updateProfile, uploadRecipeImage
src/types.ts          — Ingredient מוגדר במפורש; אפס any בשכבת הנתונים
```

**נמחקים:** `src/lib/firebase.ts`, `src/lib/firestore.ts`, `firestore.rules`, `firebase-*.json`, חבילת `firebase` מ-package.json, משתני `VITE_FIREBASE_*`.
**מתעדכנים:** `AuthContext`, `useRecipes`, `Home`, `RecipeDetail`, `CreateRecipe`, `Profile`, `Navbar` (לפי הצורך).

תיקונים אגביים שנכללים במעבר:
- ולידציה שמטבח "אחר" אינו ריק (מקביל לקטגוריה).
- כפתורי "חזרה" עם `ArrowRight` במקום `ArrowLeft` (האפליקציה RTL).

## 6. טיפול בשגיאות

- `api.ts` זורק שגיאות מוקלדות; הדפים תופסים ומציגים toast בעברית (הדפוס הקיים).
- אין wrapper גנרי שזורק מתוך catch (הבעיה שהייתה ב-`handleFirestoreError`).

## 7. סדר ביצוע

1. דניאל יוצר פרויקט ב-supabase.com בהדרכה, כולל הפעלת Google OAuth (client id/secret מ-Google Cloud Console).
2. קובץ SQL אחד (`supabase/schema.sql` בריפו) להרצה ב-SQL Editor: טבלאות, אינדקסים, RLS, trigger פרופיל, bucket + מדיניות Storage.
3. מיגרציית קוד לפי סעיף 5.
4. בדיקה מקומית מלאה: התחברות, יצירה/עריכה/מחיקה של מתכון, העלאת תמונה, לייק, פרופיל, סינון וחיפוש.

## בדיקות הצלחה

- `npm run lint` (tsc) עובר נקי.
- כל זרימות המשתמש עובדות מול Supabase אמיתי.
- אין ייבוא של firebase בשום קובץ.
