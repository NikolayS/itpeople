import { describe, test, expect } from 'bun:test'
import { detectSpokenLanguage } from '../lib/github'

describe('detectSpokenLanguage', () => {
  describe('Cyrillic detection', () => {
    test('detects Russian from Cyrillic bio', () => {
      expect(detectSpokenLanguage('Привет мир', null, null)).toBe('Russian')
    })

    test('detects Russian from Cyrillic name', () => {
      expect(detectSpokenLanguage(null, null, 'Николай')).toBe('Russian')
    })
  })

  describe('CJK detection', () => {
    test('detects Chinese from Chinese characters', () => {
      expect(detectSpokenLanguage('我是程序员', null, null)).toBe('Chinese')
    })

    test('detects Japanese from Hiragana', () => {
      expect(detectSpokenLanguage('こんにちは', null, null)).toBe('Japanese')
    })

    test('detects Japanese from Katakana', () => {
      expect(detectSpokenLanguage('プログラマー', null, null)).toBe('Japanese')
    })

    test('detects Korean from Hangul', () => {
      expect(detectSpokenLanguage('안녕하세요', null, null)).toBe('Korean')
    })
  })

  describe('Bio patterns', () => {
    test('detects Russian from "from russia" in bio', () => {
      expect(detectSpokenLanguage('Developer from Russia', null, null)).toBe('Russian')
    })

    test('detects Russian from "from moscow" in bio', () => {
      expect(detectSpokenLanguage('Software engineer from Moscow', null, null)).toBe('Russian')
    })

    test('detects Russian from "from ukraine" in bio', () => {
      expect(detectSpokenLanguage('Backend developer from Ukraine', null, null)).toBe('Russian')
    })

    test('detects German from "deutsch" in bio', () => {
      expect(detectSpokenLanguage('Deutsch sprechend', null, null)).toBe('German')
    })

    test('detects Spanish from "español" in bio', () => {
      expect(detectSpokenLanguage('Hablo español', null, null)).toBe('Spanish')
    })
  })

  describe('Surname-based detection (Russian)', () => {
    test('detects Russian from -ov surname', () => {
      expect(detectSpokenLanguage(null, null, 'John Petrov')).toBe('Russian')
    })

    test('detects Russian from -ev surname', () => {
      expect(detectSpokenLanguage(null, null, 'Alex Medvedev')).toBe('Russian')
    })

    test('detects Russian from -ova surname', () => {
      expect(detectSpokenLanguage(null, null, 'Anna Petrova')).toBe('Russian')
    })

    test('detects Russian from -sky surname', () => {
      expect(detectSpokenLanguage(null, null, 'Mike Brodsky')).toBe('Russian')
    })

    test('detects Russian from -enko surname', () => {
      expect(detectSpokenLanguage(null, null, 'Taras Shevchenko')).toBe('Russian')
    })

    test('detects Russian from -chuk surname', () => {
      expect(detectSpokenLanguage(null, null, 'Ivan Polishchuk')).toBe('Russian')
    })

    test('detects Russian from -ovich surname', () => {
      expect(detectSpokenLanguage(null, null, 'Peter Ivanovich')).toBe('Russian')
    })

    test('ignores short surnames that might match pattern', () => {
      // "ev" is too short (less than 5 chars)
      expect(detectSpokenLanguage(null, null, 'John Ev')).toBeNull()
    })

    test('handles single name without surname', () => {
      expect(detectSpokenLanguage(null, null, 'Alice')).toBeNull()
    })
  })

  describe('Location-based detection', () => {
    test('detects Russian from Russia location', () => {
      expect(detectSpokenLanguage(null, 'Russia', null)).toBe('Russian')
    })

    test('detects Russian from Moscow location', () => {
      expect(detectSpokenLanguage(null, 'Moscow, Russia', null)).toBe('Russian')
    })

    test('detects Russian from Kyiv location', () => {
      expect(detectSpokenLanguage(null, 'Kyiv, Ukraine', null)).toBe('Russian')
    })

    test('detects Russian from Belarus location', () => {
      expect(detectSpokenLanguage(null, 'Minsk, Belarus', null)).toBe('Russian')
    })
  })

  describe('No detection cases', () => {
    test('returns null for English bio without indicators', () => {
      expect(detectSpokenLanguage('Software developer passionate about open source', null, null)).toBeNull()
    })

    test('returns null for generic location', () => {
      expect(detectSpokenLanguage(null, 'San Francisco, CA', null)).toBeNull()
    })

    test('returns null for generic name', () => {
      expect(detectSpokenLanguage(null, null, 'John Smith')).toBeNull()
    })

    test('returns null when all inputs are null', () => {
      expect(detectSpokenLanguage(null, null, null)).toBeNull()
    })
  })

  describe('Priority and combinations', () => {
    test('Cyrillic in bio takes priority', () => {
      // Cyrillic is checked first
      expect(detectSpokenLanguage('Привет', 'Berlin, Germany', 'John Smith')).toBe('Russian')
    })

    test('surname detection works with English bio', () => {
      expect(detectSpokenLanguage('Senior developer', 'Berlin, Germany', 'Dmitry Petrov')).toBe('Russian')
    })
  })
})
