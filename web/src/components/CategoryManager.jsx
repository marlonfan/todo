import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { categoriesAPI } from '../api/client';

const EMOJI_OPTIONS = ['📁', '📌', '🧠', '💼', '📚', '🏠', '💡', '🛒', '🏃', '🎯', '💰', '❤️', '🎮', '✈️', '🍜', '🧹'];

function CategoryManager() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data);
    } catch (err) {
      setError(t('category.noCategories'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, data);
        setEditingCategory(null);
      } else {
        await categoriesAPI.create(data);
      }
      reset();
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || t('common.loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('emoji', category.emoji || '📁');
    setValue('color', category.color);
  };

  const handleDelete = async (id) => {
    if (!confirm(t('category.deleteConfirm'))) return;

    setLoading(true);
    try {
      await categoriesAPI.delete(id);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || t('category.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    reset();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-semibold">{t('nav.categories')}</h2>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="text-lg font-medium mb-4">
              {editingCategory ? t('category.editCategory') : t('category.newCategory')}
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  {...register('name', { required: true })}
                  type="text"
                  placeholder={t('category.name')}
                  className="form-input"
                />
              </div>
              <div className="w-32">
                <select
                  {...register('emoji')}
                  defaultValue="📁"
                  className="form-select"
                >
                  {EMOJI_OPTIONS.map((emoji) => (
                    <option key={emoji} value={emoji}>
                      {emoji}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  {...register('color')}
                  type="color"
                  defaultValue="#3788d8"
                  className="w-12 h-10 rounded cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="btn-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {editingCategory ? t('common.save') : t('common.add')}
                </button>
              </div>
            </div>
          </form>

          {/* Categories List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {categories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('category.noCategories')}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {categories.map((category) => (
                  <li key={category.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-xl leading-none">{category.emoji || '📁'}</span>
                      <span
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryManager;
