import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRecipe, createRecipe, updateRecipe, uploadRecipeImage } from '../lib/api';
import { Ingredient } from '../types';
import { Plus, Minus, ChefHat, Save, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { isValidImageUrl } from '../lib/utils';
import { toast } from '../components/ui/Toaster';
import { motion } from 'motion/react';
import { DEFAULT_CATEGORIES, DEFAULT_CUISINES } from '../lib/categories';

export function CreateRecipe() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCuisine, setShowCustomCuisine] = useState(false);
  const [customCuisine, setCustomCuisine] = useState('');

  const [formData, setFormData] = useState<{
    title: string; description: string; prepTime: number; category: string;
    cuisine: string; secretTip: string; imageUrl: string; isPublic: boolean;
    ingredients: Ingredient[]; instructions: string[];
  }>({
    title: '', description: '', prepTime: 30,
    category: DEFAULT_CATEGORIES[0], cuisine: DEFAULT_CUISINES[0],
    secretTip: '', imageUrl: '', isPublic: true,
    ingredients: [{ name: '', amount: '', unit: '' }],
    instructions: ['']
  });

  useEffect(() => {
    if (!id) return;
    const fetchRecipe = async () => {
      setFetching(true);
      try {
        const data = await getRecipe(id);
        if (!data || data.authorId !== user?.id) {
          navigate('/');
          return;
        }
        const isStandard = DEFAULT_CATEGORIES.includes(data.category);
        const isStandardCuisine = DEFAULT_CUISINES.includes(data.cuisine || '');
        setFormData({
          title: data.title,
          description: data.description,
          prepTime: data.prepTime,
          category: isStandard ? data.category : 'אחר',
          cuisine: isStandardCuisine ? (data.cuisine || DEFAULT_CUISINES[0]) : 'אחר',
          secretTip: data.secretTip || '',
          imageUrl: data.imageUrl || '',
          isPublic: data.isPublic,
          ingredients: data.ingredients,
          instructions: data.instructions
        });
        if (!isStandard) { setShowCustomCategory(true); setCustomCategory(data.category); }
        if (data.cuisine && !isStandardCuisine) { setShowCustomCuisine(true); setCustomCuisine(data.cuisine); }
      } catch (error) {
        console.error(error);
        toast('שגיאה בטעינת המתכון', 'error');
      } finally {
        setFetching(false);
      }
    };
    fetchRecipe();
  }, [id, user, navigate]);

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('התמונה גדולה מדי. המגבלה היא 5MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadRecipeImage(user.id, file);
      setFormData(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error(err);
      toast('שגיאה בהעלאת התמונה', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (formData.category === 'אחר' && !customCategory.trim()) {
      toast('אנא הזינו שם קטגוריה', 'error');
      return;
    }
    if (formData.cuisine === 'אחר' && !customCuisine.trim()) {
      toast('אנא הזינו סוג מטבח', 'error');
      return;
    }

    setLoading(true);
    try {
      const input = {
        title: formData.title,
        description: formData.description,
        prepTime: formData.prepTime,
        category: formData.category === 'אחר' ? customCategory.trim() : formData.category,
        cuisine: formData.cuisine === 'אחר' ? customCuisine.trim() : formData.cuisine,
        secretTip: formData.secretTip,
        imageUrl: formData.imageUrl,
        isPublic: formData.isPublic,
        ingredients: formData.ingredients,
        instructions: formData.instructions,
      };
      if (id) {
        await updateRecipe(id, input);
        toast('המתכון עודכן בהצלחה!');
      } else {
        await createRecipe(user.id, input);
        toast('המתכון נוצר בהצלחה!');
      }
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast('שגיאה בשמירת המתכון', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInstructionChange = (index: number, value: string) => {
    const instructions = [...formData.instructions];
    instructions[index] = value;
    setFormData({ ...formData, instructions });
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const ingredients = [...formData.ingredients];
    ingredients[index] = { ...ingredients[index], [field]: value };
    setFormData({ ...formData, ingredients });
  };

  const addListItem = (type: 'ingredients' | 'instructions') => {
    const newItem = type === 'ingredients' ? { name: '', amount: '', unit: '' } : '';
    setFormData({ ...formData, [type]: [...formData[type], newItem] });
  };

  const removeListItem = (type: 'ingredients' | 'instructions', index: number) => {
    const newList = formData[type].filter((_, i) => i !== index);
    setFormData({ ...formData, [type]: newList });
  };

  if (fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-8 font-medium transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה
      </button>

      <form onSubmit={handleSubmit} className="space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="font-serif text-4xl font-bold text-[var(--foreground)]">
              {id ? 'עריכת מתכון' : 'מתכון חדש'}
            </h1>
            <p className="text-stone-500 dark:text-stone-400 font-medium">שתפו את יצירת המופת הקולינרית שלכם עם העולם.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary-200 dark:shadow-none"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {id ? 'שמירת שינויים' : 'יצירת מתכון'}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">שם המתכון</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="למשל: הפסטה הסודית של סבתא"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all dark:bg-stone-900 text-[var(--foreground)]"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">תיאור</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="ספרו לנו קצת על המנה..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all resize-none dark:bg-stone-900 text-[var(--foreground)]"
                />
              </div>

              <div className="space-y-4 border-t border-stone-50 dark:border-stone-800 pt-6">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">סוד המנה / טיפ מנצח (אופציונאלי)</label>
                <textarea
                  value={formData.secretTip}
                  onChange={(e) => setFormData({ ...formData, secretTip: e.target.value })}
                  placeholder="מה הסוד שהופך את המנה הזו למנצחת? טיפ קטן שעושה הבדל גדול..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all resize-none italic text-stone-600 dark:text-stone-400 font-serif dark:bg-stone-900"
                />
              </div>
            </section>

            <section className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">רכיבים</label>
                  <button 
                    type="button" 
                    onClick={() => addListItem('ingredients')}
                    className="p-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {formData.ingredients.map((ing, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-3 p-4 bg-stone-50 dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-stone-400 uppercase">שם הרכיב</label>
                        <input
                          type="text"
                          required
                          value={ing.name || ''}
                          onChange={(e) => handleIngredientChange(i, 'name', e.target.value)}
                          placeholder={`רכיב ${i + 1}`}
                          className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm dark:bg-stone-900 text-[var(--foreground)]"
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="w-24 space-y-1">
                          <label className="text-xs font-bold text-stone-400 uppercase">כמות</label>
                          <input
                            type="text"
                            value={ing.amount || ''}
                            onChange={(e) => handleIngredientChange(i, 'amount', e.target.value)}
                            placeholder="כמות"
                            className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm dark:bg-stone-900 text-[var(--foreground)]"
                          />
                        </div>
                        
                        <div className="w-28 space-y-1">
                          <label className="text-xs font-bold text-stone-400 uppercase">יחידה</label>
                          <select
                            value={ing.unit || ''}
                            onChange={(e) => handleIngredientChange(i, 'unit', e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm dark:bg-stone-900 text-[var(--foreground)]"
                          >
                            <option value="">יחידה</option>
                            <option value="גרם">גרם</option>
                            <option value="ק״ג">ק״ג</option>
                            <option value="מ״ל">מ״ל</option>
                            <option value="ליטר">ליטר</option>
                            <option value="כף">כף</option>
                            <option value="כפית">כפית</option>
                            <option value="כוס">כוס</option>
                            <option value="יחידה">יחידה</option>
                            <option value="קורט">קורט</option>
                            <option value="חבילה">חבילה</option>
                          </select>
                        </div>
                        
                        <div className="flex items-end pb-1">
                          {formData.ingredients.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeListItem('ingredients', i)}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">הוראות הכנה</label>
                  <button 
                    type="button" 
                    onClick={() => addListItem('instructions')}
                    className="p-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {formData.instructions.map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="flex-none w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xs font-bold text-stone-500 dark:text-stone-400">
                        {i + 1}
                      </span>
                      <textarea
                        required
                        value={step}
                        onChange={(e) => handleInstructionChange(i, e.target.value)}
                        placeholder="תיאור השלב..."
                        rows={2}
                        className="flex-1 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm resize-none dark:bg-stone-900 text-[var(--foreground)]"
                      />
                      {formData.instructions.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeListItem('instructions', i)}
                          className="pt-2 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <section className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">קטגוריה</label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, category: val });
                    setShowCustomCategory(val === 'אחר');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 outline-none bg-stone-50 dark:bg-stone-900 text-sm font-bold text-[var(--foreground)] cursor-pointer hover:border-primary-300 transition-colors"
                >
                  {DEFAULT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="אחר">אחר (מלל חופשי)</option>
                </select>

                {showCustomCategory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2"
                  >
                    <input
                      type="text"
                      required
                      placeholder="הזינו שם קטגוריה..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm font-bold dark:bg-stone-900 text-[var(--foreground)]"
                    />
                  </motion.div>
                )}
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">מטבח</label>
                <select
                  value={formData.cuisine}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, cuisine: val });
                    setShowCustomCuisine(val === 'אחר');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 outline-none bg-stone-50 dark:bg-stone-900 text-sm font-bold text-[var(--foreground)] cursor-pointer hover:border-primary-300 transition-colors"
                >
                  {DEFAULT_CUISINES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="אחר">אחר (מלל חופשי)</option>
                </select>

                {showCustomCuisine && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2"
                  >
                    <input
                      type="text"
                      required
                      placeholder="הזינו סוג מטבח..."
                      value={customCuisine}
                      onChange={(e) => setCustomCuisine(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm font-bold dark:bg-stone-900 text-[var(--foreground)]"
                    />
                  </motion.div>
                )}
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">זמן הכנה (דקות)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.prepTime}
                  onChange={(e) => setFormData({ ...formData, prepTime: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 outline-none bg-stone-50 dark:bg-stone-900 text-[var(--foreground)] font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-4 border-t border-stone-50 dark:border-stone-800 pt-6">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">צפייה פומבית</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="w-5 h-5 rounded accent-primary-500"
                  />
                  <span className="text-sm font-bold text-[var(--foreground)]">גלוי לכולם</span>
                </div>
              </div>
            </section>

            <section className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">תמונת המתכון</label>
                <label 
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/20 cursor-pointer transition-colors flex items-center gap-2"
                >
                  {uploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  בחירה
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      if (url === '' || isValidImageUrl(url)) {
                        setFormData({ ...formData, imageUrl: url });
                      }
                    }}
                    placeholder="או הדביקו כתובת תמונה..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 outline-none text-xs dark:bg-stone-900 text-[var(--foreground)] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                  />
                </div>
                
                <div className="aspect-video rounded-2xl bg-stone-50 dark:bg-stone-900 border border-dashed border-stone-200 dark:border-stone-800 flex items-center justify-center overflow-hidden group relative">
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center space-y-2">
                      <ChefHat className="w-8 h-8 text-stone-200 dark:text-stone-800 mx-auto" />
                      <p className="text-xs text-stone-400 font-bold italic">אין תמונה שנבחרה</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}
