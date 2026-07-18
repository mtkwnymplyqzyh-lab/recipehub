export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string; // only known for the signed-in user (comes from auth, not the DB)
  photoURL?: string;
  bio?: string;
  createdAt: string;
}

export type Category = string;

export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
}

export interface Recipe {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  imageUrl?: string;
  category: Category;
  cuisine?: string;
  secretTip?: string;
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  description: string;
  prepTime: number;
  category: string;
  cuisine: string;
  secretTip: string;
  imageUrl: string;
  isPublic: boolean;
  ingredients: Ingredient[];
  instructions: string[];
}
