// Category Keywords for Question Classification
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Love: [
    'love', 'boyfriend', 'girlfriend', 'partner', 'dating',
    'crush', 'affair', 'romance', 'romantic', 'ishq', 'pyar', 'pyaar', 'mohabbat',
    'breakup', 'break up', 'break-up', 'ex-', 'relationship',
    'compatibility', 'soulmate', 'prem', 'bf', 'gf'
  ],
  Marriage: [
    'marriage', 'marry', 'wedding', 'spouse', 'husband', 'wife',
    'shadi', 'shaadi', 'vivah', 'rishta', 'life partner',
    'propose', 'proposal', 'engagement', 'divorce',
    'married', 'matrimony', 'bride', 'groom'
  ],
  Career: ['career', 'job', 'work', 'profession', 'business', 'employment', 'salary', 'promotion', 'interview', 'office', 'colleague', 'boss', 'workplace'],
  Health: ['health', 'disease', 'illness', 'medicine', 'doctor', 'hospital', 'treatment', 'fitness', 'exercise', 'diet', 'wellness', 'surgery', 'pain'],
  Money: ['money', 'wealth', 'finance', 'income', 'salary', 'investment', 'property', 'business', 'profit', 'loss', 'financial', 'rich', 'poor', 'savings'],
  Spiritual: ['spiritual', 'karma', 'destiny', 'purpose', 'soul', 'god', 'prayer', 'meditation', 'enlightenment', 'moksha', 'dharma', 'past life', 'reincarnation']
}

/**
 * Categorize a question based on keywords
 * Returns the category with highest score, or 'default' if no match
 */
export function categorizeQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase()
  const categoryScores: Record<string, number> = {}

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lowerQuestion.includes(keyword)) {
        score++
      }
    }
    if (score > 0) {
      categoryScores[category] = score
    }
  }

  // Return category with highest score, or 'default' if no match
  const topCategory = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b, 'default'
  )

  return categoryScores[topCategory] > 0 ? topCategory : 'default'
}

