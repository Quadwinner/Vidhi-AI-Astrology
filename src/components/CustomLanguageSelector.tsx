import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { languages } from '../constants/languages';

// --- STYLES (No changes from before) ---

const SelectorContainer = styled.div`
  position: relative;
  z-index: 10000000;
  pointer-events: auto;
`;

const SelectorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  height: 44px;
  padding: 0 16px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  transition: background-color 0.3s;
  color: white;
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: auto;
  user-select: none;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  &:active {
    background-color: rgba(255, 255, 255, 0.15);
  }
`;

const StyledGlobeIcon = styled.div`
  width: 18px;
  height: 18px;
  background-color: white;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1-H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.62-1.23 4.96-3.1 6.39z'/%3E%3C/svg%3E") no-repeat center;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.62-1.23 4.96-3.1 6.39z'/%3E%3C/svg%3E") no-repeat center;
`;

const Dropdown = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 250px;
  height: 300px;
  z-index: 9999999;
  overflow: hidden;
  background: rgba(20, 20, 40, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  outline: none;
  box-sizing: border-box;
  flex-shrink: 0;
  background: transparent;
  color: white;
  font-family: 'Sora', sans-serif;
  font-size: 16px;
  pointer-events: auto;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const LanguageList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  flex-grow: 1;
  overflow-y: auto;
  pointer-events: auto;
`;

const LanguageListItem = styled.li`
  padding: 10px 12px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Sora', sans-serif;
  font-size: 15px;
  transition: background-color 0.2s;
  pointer-events: auto;
  user-select: none;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &:active {
    background-color: rgba(255, 255, 255, 0.15);
  }
`;

const CustomLanguageSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLanguageSelect = (langCode: string) => {
    setCurrentLanguage(langCode);
    setIsOpen(false);

    const googleTranslateSelect = document.querySelector(
      '#google_translate_element select'
    ) as HTMLSelectElement | null;

    if (googleTranslateSelect) {
      googleTranslateSelect.value = langCode;
      const event = new Event('change', { bubbles: true });
      googleTranslateSelect.dispatchEvent(event);
    } else {
      console.error('Could not find the Google Translate select element.');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    const checkCookie = () => {
      const cookieMatch = document.cookie.match(/googtrans=([^\/]*)\/([^\/]*)/);
      if (cookieMatch && cookieMatch[2]) {
        setCurrentLanguage(cookieMatch[2]);
      }
    };
    const timer = setTimeout(checkCookie, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SelectorContainer ref={dropdownRef}>
      {/* --- THIS IS THE FIX --- */}
      {/* We add className="notranslate" to prevent Google from translating the button's text */}
      <SelectorHeader onClick={() => setIsOpen(!isOpen)} className="notranslate">
        <StyledGlobeIcon />
        <span>{currentLanguage.toUpperCase()}</span>
      </SelectorHeader>
      {isOpen && (
        <Dropdown>
          <SearchInput
            type="text"
            placeholder="Search language..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
            autoFocus
          />
          <LanguageList>
            {filteredLanguages.map(lang => (
              <LanguageListItem
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                {lang.name}
              </LanguageListItem>
            ))}
          </LanguageList>
        </Dropdown>
      )}
    </SelectorContainer>
  );
};

export default CustomLanguageSelector;