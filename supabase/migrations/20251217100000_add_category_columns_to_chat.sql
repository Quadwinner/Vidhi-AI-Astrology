-- Migration: Add category tracking columns to chat_history
-- Created: 2025-12-17
-- Purpose: Track question categories and sub-categories for CleverTap segmentation

-- Add question_category column
ALTER TABLE public.chat_history
ADD COLUMN IF NOT EXISTS question_category TEXT;

-- Add sub_category column
ALTER TABLE public.chat_history
ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Create index for faster category queries
CREATE INDEX IF NOT EXISTS idx_chat_history_category
ON public.chat_history(question_category);

CREATE INDEX IF NOT EXISTS idx_chat_history_sub_category
ON public.chat_history(sub_category);

-- Add comment
COMMENT ON COLUMN public.chat_history.question_category IS 'Main category of the question (Love, Marriage, Career, Health, Money, Spiritual, etc.)';
COMMENT ON COLUMN public.chat_history.sub_category IS 'Sub-category for more detailed tracking';
