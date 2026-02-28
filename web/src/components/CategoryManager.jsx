import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { categoriesAPI } from '../api/client';
import { useCategoriesQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';

const EMOJI_OPTIONS = ['📁', '📌', '🧠', '💼', '📚', '🏠', '💡', '🛒', '🏃', '🎯', '💰', '❤️', '🎮', '✈️', '🍜', '🧹'];

function CategoryManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useCategoriesQuery();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const { register, handleSubmit, reset, setValue } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    setError('');
    const previousCategories = queryClient.getQueryData(queryKeys.categories.all);

    try {
      if (editingCategory) {
        queryClient.setQueryData(queryKeys.categories.all, (prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((item) => (item.id === editingCategory.id ? { ...item, ...data } : item));
        });

        const res = await categoriesAPI.update(editingCategory.id, data);
        if (res?.data?.id) {
          queryClient.setQueryData(queryKeys.categories.all, (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((item) => (item.id === res.data.id ? res.data : item));
          });
        }
        setEditingCategory(null);
      } else {
        const tempID = -Date.now();
        queryClient.setQueryData(queryKeys.categories.all, (prev) => {
          const base = Array.isArray(prev) ? prev : [];
          return [{ id: tempID, ...data }, ...base];
        });

        const res = await categoriesAPI.create(data);
        if (res?.data?.id) {
          queryClient.setQueryData(queryKeys.categories.all, (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((item) => (item.id === tempID ? res.data : item));
          });
        }
      }
      reset();
    } catch (err) {
      queryClient.setQueryData(queryKeys.categories.all, previousCategories);
      setError(err.response?.data?.error || t('common.loading'));
    } finally {
      setSubmitting(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
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

    setSubmitting(true);
    const previousCategories = queryClient.getQueryData(queryKeys.categories.all);
    queryClient.setQueryData(queryKeys.categories.all, (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.filter((item) => item.id !== id);
    });

    try {
      await categoriesAPI.delete(id);
    } catch (err) {
      queryClient.setQueryData(queryKeys.categories.all, previousCategories);
      setError(err.response?.data?.error || t('category.deleteFailed'));
    } finally {
      setSubmitting(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    reset();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="hidden border-b border-gray-200 bg-white p-4 md:block">
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
                  disabled={submitting}
                  className="btn-primary"
                >
                  {editingCategory ? t('common.save') : t('common.add')}
                </button>
              </div>
            </div>
          </form>

          {/* Categories List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {isLoading && (
              <div className="p-4 text-sm text-gray-500">{t('common.loading')}</div>
            )}
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
