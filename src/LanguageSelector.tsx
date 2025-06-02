import { useState, useEffect } from 'react';
import { Select, MenuItem, FormControl } from '@mui/material';
import { LanguageSelectorProps } from './types/props';
import { Languages } from './language';  

export default function LanguageSelector({ 
  onLanguageChange,
}: LanguageSelectorProps) {
  const defaultLanguage = 'en';
  const paramName = 'lang';
  const sx = {};

  // Get initial language from URL or use default
  const getInitialLanguage = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const langParam = queryParams.get(paramName);
    // Validate that the language exists in our options
    return langParam && Languages[langParam] ? langParam : defaultLanguage;
  };

  const [currentLang, setCurrentLang] = useState(getInitialLanguage);
  
  // Make sure the initial language is properly set based on URL
  useEffect(() => {
    // Check URL parameter on mount and notify parent if needed
    const initialLang = getInitialLanguage();
    if (initialLang !== defaultLanguage && onLanguageChange && initialLang in Languages) {
      setCurrentLang(initialLang);
      onLanguageChange(Languages[initialLang]);
    }
  }, [onLanguageChange]);
  
  // Update language when URL changes (e.g., user navigates with browser controls)
  useEffect(() => {
    const handleUrlChange = () => {
      const newLang = getInitialLanguage();
      if (newLang !== currentLang) {
        setCurrentLang(newLang);
        
        // Also notify parent component to trigger reload with new language
        if (onLanguageChange && newLang in Languages) {
          onLanguageChange(Languages[newLang]);
        }
      }
    };

    // Listen for popstate events (back/forward browser navigation)
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [currentLang, paramName, onLanguageChange]);

  const handleLanguageChange = (newLang: string) => {
    setCurrentLang(newLang);
    
    // Update the URL with the new language parameter
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    params.set(paramName, newLang);
    
    // Preserve the hash part (which contains your React Router routes)
    const newUrl = `${window.location.pathname}?${params}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
    
    // Call the optional callback if provided
    if (onLanguageChange) {
        if (newLang in Languages) {
          onLanguageChange(Languages[newLang]);
        }
    }
  };

  return (
    <FormControl size="small" sx={{ minWidth: 70, position: "initial", ...sx }} className="language-selector">
      <Select
        sx={{backgroundColor: 'white'}}
        value={currentLang}
        onChange={(e) => handleLanguageChange(e.target.value!)}
        renderValue={(selected) => {
          const selectedLang = selected && selected in Languages ? Languages[selected] : null;
          return <span style={{ fontSize: '1.2rem' }}>{selectedLang?.icon}</span>;
        }}
      >
        {Object.values(Languages).map((language) => (
          <MenuItem key={language.code} value={language.code} sx={{backgroundColor: 'white'}}>
            <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{language.icon}</span>
            {language.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}