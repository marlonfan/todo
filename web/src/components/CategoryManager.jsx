import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { categoriesAPI } from '../api/client';
import { useCategoriesQuery } from '../query/hooks';
import { queryKeys } from '../query/keys';
import { replaceCategories } from '../data/localStore';
import Select from './ui/Select';

const EMOJI_OPTIONS = ['📁', '📌', '🧠', '💼', '📚', '🏠', '💡', '🛒', '🏃', '🎯', '💰', '❤️', '🎮', '✈️', '🍜', '🧹'];

function CategoryManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useCategoriesQuery();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const persistCategoriesSnapshot = async () => {
    const snapshot = queryClient.getQueryData(queryKeys.categories.all);
    if (Array.isArray(snapshot)) {
      await replaceCategories(snapshot);
    }
  };

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
        await persistCategoriesSnapshot();

        const res = await categoriesAPI.update(editingCategory.id, data);
        if (res?.data?.id) {
          queryClient.setQueryData(queryKeys.categories.all, (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((item) => (item.id === res.data.id ? res.data : item));
          });
          await persistCategoriesSnapshot();
        }
        setEditingCategory(null);
      } else {
        const tempID = -Date.now();
        queryClient.setQueryData(queryKeys.categories.all, (prev) => {
          const base = Array.isArray(prev) ? prev : [];
          return [{ id: tempID, ...data }, ...base];
        });
        await persistCategoriesSnapshot();

        const res = await categoriesAPI.create(data);
        if (res?.data?.id) {
          queryClient.setQueryData(queryKeys.categories.all, (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((item) => (item.id === tempID ? res.data : item));
          });
          await persistCategoriesSnapshot();
        }
      }
      reset();
    } catch (err) {
      queryClient.setQueryData(queryKeys.categories.all, previousCategories);
      await persistCategoriesSnapshot();
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
    await persistCategoriesSnapshot();

    try {
      await categoriesAPI.delete(id);
    } catch (err) {
      queryClient.setQueryData(queryKeys.categories.all, previousCategories);
      await persistCategoriesSnapshot();
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
      <div className="hidden border-b border-blue-100 bg-white/90 p-4 md:block">
        <h2 className="text-xl font-semibold">{t('nav.categories')}</h2>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="md-card mb-6 p-5">
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
                <Select
                  value={watch('emoji') || '📁'}
                  onChange={(e) => setValue('emoji', e.target.value)}
                  className="form-select"
                >
                  {EMOJI_OPTIONS.map((emoji) => (
                    <option key={emoji} value={emoji}>
                      {emoji}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <input
                  {...register('color')}
                  type="color"
                  defaultValue="#3788d8"
                  className="h-10 w-12 cursor-pointer rounded-xl border border-blue-100 bg-white"
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
          <div className="md-card overflow-hidden">
            {isLoading && (
              <div className="p-4 text-sm text-slate-500">{t('common.loading')}</div>
            )}
            {categories.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {t('category.noCategories')}
              </div>
            ) : (
              <ul className="divide-y divide-blue-100">
                {categories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between p-4 transition-colors hover:bg-blue-50/60">
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
                        className="rounded-full px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="rounded-full px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
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
