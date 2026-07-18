import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserRecipes } from '../hooks/useRecipes';
import { RecipeCard } from '../components/RecipeCard';
import { ChefHat, Heart, Book, Settings, User as UserIcon, X, Save, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getProfile, updateProfile, getFavoriteRecipes, uploadRecipeImage } from '../lib/api';
import { toast } from '../components/ui/Toaster';
import { Recipe, UserProfile } from '../types';

export function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'recipes' | 'favorites'>('recipes');
  const [favRecipes, setFavRecipes] = useState<Recipe[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', photoURL: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const id = userId || currentUser?.id;
  const isOwnProfile = id === currentUser?.id;

  const { recipes, loading } = useUserRecipes(id || '', isOwnProfile);

  useEffect(() => {
    if (!id) return;
    if (isOwnProfile && currentProfile) {
      setProfile(currentProfile);
      return;
    }
    getProfile(id)
      .then(p => { if (p) setProfile(p); })
      .catch(err => console.error(err));
  }, [id, isOwnProfile, currentProfile]);

  useEffect(() => {
    if (profile) {
      setEditForm({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!id || activeTab !== 'favorites') return;
    let cancelled = false;
    setLoadingFavs(true);
    getFavoriteRecipes(id)
      .then(r => { if (!cancelled) setFavRecipes(r); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoadingFavs(false); });
    return () => { cancelled = true; };
  }, [id, activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateProfile(currentUser.id, {
        displayName: editForm.displayName,
        bio: editForm.bio,
        photoURL: editForm.photoURL,
      });
      setProfile(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast('שגיאה בעדכון הפרופיל', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('התמונה גדולה מדי. המגבלה היא 5MB', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadRecipeImage(currentUser.id, file);
      setEditForm(prev => ({ ...prev, photoURL: url }));
    } catch (err) {
      console.error(err);
      toast('שגיאה בהעלאת התמונה', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!id) return <div className="text-center py-20">אנא התחברו כדי לצפות בפרופיל.</div>;

  return (
    <div className="space-y-12 pb-20">
      <header className="bg-[var(--card)] rounded-[40px] p-10 border border-[var(--border)] shadow-sm flex flex-col md:flex-row items-center gap-10">
        <div className="relative group">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-stone-50 dark:border-stone-800 shadow-inner">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-300 dark:text-stone-600">
                <UserIcon className="w-16 h-16" />
              </div>
            )}
          </div>
          {isOwnProfile && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute -bottom-1 -left-1 bg-stone-900 text-white p-2.5 rounded-xl border-4 border-white dark:border-stone-900 cursor-pointer hover:bg-primary-600 hover:scale-110 transition-all shadow-lg active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-center md:text-right space-y-4 flex-1">
          <div className="space-y-1">
            <h1 className="font-serif text-4xl font-bold text-[var(--foreground)]">{profile?.displayName || 'שף'}</h1>
            <p className="text-stone-400 dark:text-stone-500 font-medium">{profile?.email}</p>
          </div>
          <p className="text-stone-600 dark:text-stone-400 max-w-xl font-medium leading-relaxed italic">
            {profile?.bio || (isOwnProfile ? "עדיין לא כתבת ביוגרפיה. שתפו משהו על המסע הקולינרי שלכם!" : "מבשלים באהבה.")}
          </p>
          <div className="flex items-center justify-center md:justify-start gap-8 pt-2">
            <div className="text-center md:text-right">
              <p className="text-2xl font-bold text-[var(--foreground)]">{recipes.length}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">מתכונים</p>
            </div>
            {isOwnProfile && (
              <div className="text-center md:text-right">
                <p className="text-2xl font-bold text-[var(--foreground)]">0</p>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">עוקבים</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Edit Bio Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[var(--card)] rounded-[2.5rem] p-8 shadow-2xl border border-[var(--border)] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-serif text-2xl font-bold text-[var(--foreground)]">עדכון פרופיל</h2>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2 text-center">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-100 shadow-lg mx-auto">
                      {editForm.photoURL ? (
                        <img src={editForm.photoURL} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-300">
                          <UserIcon className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-xl hover:bg-primary-100 cursor-pointer transition-colors">
                    {uploadingPhoto ? (
                      <div className="w-3.5 h-3.5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    העלאת תמונה מהמכשיר
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">שם תצוגה</label>
                  <input 
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full bg-stone-50 dark:bg-stone-900 border border-[var(--border)] rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-[var(--foreground)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">ביוגרפיה</label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={editForm.bio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="ספרו קצת על עצמכם..."
                    className="w-full bg-stone-50 dark:bg-stone-900 border border-[var(--border)] rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium text-[var(--foreground)] resize-none"
                  />
                  <p className="text-right text-xs text-stone-400 font-bold">{editForm.bio.length}/500</p>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-200 dark:shadow-none hover:bg-primary-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      שמירת שינויים
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        <div className="flex items-center gap-8 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('recipes')}
            className={cn(
              "pb-4 text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-2",
              activeTab === 'recipes' ? "text-primary-600 border-b-2 border-primary-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <Book className="w-4 h-4" />
            המתכונים שלי
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('favorites')}
              className={cn(
                "pb-4 text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-2",
                activeTab === 'favorites' ? "text-primary-600 border-b-2 border-primary-600" : "text-stone-400 hover:text-stone-600"
              )}
            >
              <Heart className="w-4 h-4" />
              מועדפים
            </button>
          )}
        </div>

        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="aspect-[4/5] bg-[var(--card)] rounded-3xl animate-pulse border border-[var(--border)]" />)
            ) : recipes.length > 0 ? (
              recipes.map(r => <RecipeCard key={r.id} recipe={r} />)
            ) : (
              <div className="col-span-full py-20 text-center text-stone-400 font-serif italic text-lg">
                עדיין לא נוצרו מתכונים.
              </div>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingFavs ? (
              [...Array(3)].map((_, i) => <div key={i} className="aspect-[4/5] bg-[var(--card)] rounded-3xl animate-pulse border border-[var(--border)]" />)
            ) : favRecipes.length > 0 ? (
              favRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)
            ) : (
              <div className="col-span-full py-20 text-center text-stone-400 font-serif italic text-lg">
                עדיין לא שמרת מתכונים למועדפים.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
