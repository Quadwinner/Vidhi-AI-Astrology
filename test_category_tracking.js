// Test script to verify category tracking is working
// Run with: node test_category_tracking.js

const CATEGORY_KEYWORDS = {
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

function categorizeQuestion(question) {
  const lowerQuestion = question.toLowerCase()
  const categoryScores = {}

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

  const topCategory = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b, 'default'
  )

  return categoryScores[topCategory] > 0 ? topCategory : 'default'
}

// Test cases
console.log('🧪 Testing Category Detection\n')
console.log('=' .repeat(60))

const testCases = [
  { question: "Will I find love this year?", expected: "Love" },
  { question: "When will I get married?", expected: "Marriage" },
  { question: "What about my career prospects?", expected: "Career" },
  { question: "Will I have good health?", expected: "Health" },
  { question: "How will my financial situation be?", expected: "Money" },
  { question: "What is my spiritual purpose?", expected: "Spiritual" },
  { question: "Hello, how are you?", expected: "default" },
  { question: "Mujhe pyar milega?", expected: "Love" },
  { question: "Meri shadi kab hogi?", expected: "Marriage" },
  { question: "Mera career kaisa rahega?", expected: "Career" },
]

let passed = 0
let failed = 0

testCases.forEach(({ question, expected }) => {
  const result = categorizeQuestion(question)
  const status = result === expected ? '✅ PASS' : '❌ FAIL'
  if (result === expected) {
    passed++
  } else {
    failed++
  }
  console.log(`${status} | "${question}"`)
  console.log(`        Expected: ${expected}, Got: ${result}`)
  console.log('')
})

console.log('=' .repeat(60))
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)

if (failed === 0) {
  console.log('✅ All category detection tests passed!')
} else {
  console.log('❌ Some tests failed. Please check the category keywords.')
}
