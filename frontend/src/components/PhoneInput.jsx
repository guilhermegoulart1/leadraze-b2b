// frontend/src/components/PhoneInput.jsx
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

// Funcao de mascara generica para formatos comuns
const createMask = (format) => {
  return (value) => {
    const numbers = value.replace(/\D/g, '');
    let result = '';
    let numIndex = 0;

    for (let i = 0; i < format.length && numIndex < numbers.length; i++) {
      if (format[i] === '0') {
        result += numbers[numIndex];
        numIndex++;
      } else {
        result += format[i];
      }
    }
    return result;
  };
};

// Funcao de validacao generica
const createValidator = (minLength, maxLength) => {
  return (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.length >= minLength && numbers.length <= maxLength;
  };
};

// Lista completa de paises com DDI e formato
const COUNTRIES = [
  // Americas
  {
    code: 'BR', name: 'Brasil', dialCode: '+55', flag: 'https://flagcdn.com/w40/br.png',
    format: '(00) 00000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    },
    validate: createValidator(10, 11), minLength: 10, maxLength: 11
  },
  {
    code: 'US', name: 'Estados Unidos', dialCode: '+1', flag: 'https://flagcdn.com/w40/us.png',
    format: '(000) 000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'CA', name: 'Canada', dialCode: '+1', flag: 'https://flagcdn.com/w40/ca.png',
    format: '(000) 000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'MX', name: 'Mexico', dialCode: '+52', flag: 'https://flagcdn.com/w40/mx.png',
    format: '00 0000 0000',
    mask: createMask('00 0000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'AR', name: 'Argentina', dialCode: '+54', flag: 'https://flagcdn.com/w40/ar.png',
    format: '00 0000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
      return `${numbers.slice(0, 2)} ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 11), minLength: 10, maxLength: 11
  },
  {
    code: 'CO', name: 'Colombia', dialCode: '+57', flag: 'https://flagcdn.com/w40/co.png',
    format: '000 000 0000',
    mask: createMask('000 000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'CL', name: 'Chile', dialCode: '+56', flag: 'https://flagcdn.com/w40/cl.png',
    format: '0 0000 0000',
    mask: createMask('0 0000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'PE', name: 'Peru', dialCode: '+51', flag: 'https://flagcdn.com/w40/pe.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'VE', name: 'Venezuela', dialCode: '+58', flag: 'https://flagcdn.com/w40/ve.png',
    format: '0000-0000000',
    mask: createMask('0000-0000000'),
    validate: createValidator(10, 11), minLength: 10, maxLength: 11
  },
  {
    code: 'EC', name: 'Equador', dialCode: '+593', flag: 'https://flagcdn.com/w40/ec.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'BO', name: 'Bolivia', dialCode: '+591', flag: 'https://flagcdn.com/w40/bo.png',
    format: '0 000 0000',
    mask: createMask('0 000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'PY', name: 'Paraguai', dialCode: '+595', flag: 'https://flagcdn.com/w40/py.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'UY', name: 'Uruguai', dialCode: '+598', flag: 'https://flagcdn.com/w40/uy.png',
    format: '00 000 000',
    mask: createMask('00 000 000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: 'https://flagcdn.com/w40/cr.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'PA', name: 'Panama', dialCode: '+507', flag: 'https://flagcdn.com/w40/pa.png',
    format: '0000-0000',
    mask: createMask('0000-0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'GT', name: 'Guatemala', dialCode: '+502', flag: 'https://flagcdn.com/w40/gt.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'HN', name: 'Honduras', dialCode: '+504', flag: 'https://flagcdn.com/w40/hn.png',
    format: '0000-0000',
    mask: createMask('0000-0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'SV', name: 'El Salvador', dialCode: '+503', flag: 'https://flagcdn.com/w40/sv.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: 'https://flagcdn.com/w40/ni.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'DO', name: 'Republica Dominicana', dialCode: '+1', flag: 'https://flagcdn.com/w40/do.png',
    format: '(000) 000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'PR', name: 'Porto Rico', dialCode: '+1', flag: 'https://flagcdn.com/w40/pr.png',
    format: '(000) 000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'CU', name: 'Cuba', dialCode: '+53', flag: 'https://flagcdn.com/w40/cu.png',
    format: '0 000 0000',
    mask: createMask('0 000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'JM', name: 'Jamaica', dialCode: '+1', flag: 'https://flagcdn.com/w40/jm.png',
    format: '(000) 000-0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },

  // Europa
  {
    code: 'PT', name: 'Portugal', dialCode: '+351', flag: 'https://flagcdn.com/w40/pt.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'ES', name: 'Espanha', dialCode: '+34', flag: 'https://flagcdn.com/w40/es.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'FR', name: 'Franca', dialCode: '+33', flag: 'https://flagcdn.com/w40/fr.png',
    format: '0 00 00 00 00',
    mask: createMask('0 00 00 00 00'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'DE', name: 'Alemanha', dialCode: '+49', flag: 'https://flagcdn.com/w40/de.png',
    format: '000 00000000',
    mask: createMask('000 00000000'),
    validate: createValidator(10, 11), minLength: 10, maxLength: 11
  },
  {
    code: 'IT', name: 'Italia', dialCode: '+39', flag: 'https://flagcdn.com/w40/it.png',
    format: '000 000 0000',
    mask: createMask('000 000 0000'),
    validate: createValidator(9, 10), minLength: 9, maxLength: 10
  },
  {
    code: 'GB', name: 'Reino Unido', dialCode: '+44', flag: 'https://flagcdn.com/w40/gb.png',
    format: '0000 000000',
    mask: createMask('0000 000000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'IE', name: 'Irlanda', dialCode: '+353', flag: 'https://flagcdn.com/w40/ie.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'NL', name: 'Holanda', dialCode: '+31', flag: 'https://flagcdn.com/w40/nl.png',
    format: '0 00000000',
    mask: createMask('0 00000000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'BE', name: 'Belgica', dialCode: '+32', flag: 'https://flagcdn.com/w40/be.png',
    format: '000 00 00 00',
    mask: createMask('000 00 00 00'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'CH', name: 'Suica', dialCode: '+41', flag: 'https://flagcdn.com/w40/ch.png',
    format: '00 000 00 00',
    mask: createMask('00 000 00 00'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'AT', name: 'Austria', dialCode: '+43', flag: 'https://flagcdn.com/w40/at.png',
    format: '000 0000000',
    mask: createMask('000 0000000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'PL', name: 'Polonia', dialCode: '+48', flag: 'https://flagcdn.com/w40/pl.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'CZ', name: 'Republica Tcheca', dialCode: '+420', flag: 'https://flagcdn.com/w40/cz.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'HU', name: 'Hungria', dialCode: '+36', flag: 'https://flagcdn.com/w40/hu.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'RO', name: 'Romenia', dialCode: '+40', flag: 'https://flagcdn.com/w40/ro.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'GR', name: 'Grecia', dialCode: '+30', flag: 'https://flagcdn.com/w40/gr.png',
    format: '000 000 0000',
    mask: createMask('000 000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'SE', name: 'Suecia', dialCode: '+46', flag: 'https://flagcdn.com/w40/se.png',
    format: '00 000 00 00',
    mask: createMask('00 000 00 00'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'NO', name: 'Noruega', dialCode: '+47', flag: 'https://flagcdn.com/w40/no.png',
    format: '000 00 000',
    mask: createMask('000 00 000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'DK', name: 'Dinamarca', dialCode: '+45', flag: 'https://flagcdn.com/w40/dk.png',
    format: '00 00 00 00',
    mask: createMask('00 00 00 00'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'FI', name: 'Finlandia', dialCode: '+358', flag: 'https://flagcdn.com/w40/fi.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 10), minLength: 9, maxLength: 10
  },
  {
    code: 'RU', name: 'Russia', dialCode: '+7', flag: 'https://flagcdn.com/w40/ru.png',
    format: '(000) 000-00-00',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      if (numbers.length <= 8) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 8)}-${numbers.slice(8, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'UA', name: 'Ucrania', dialCode: '+380', flag: 'https://flagcdn.com/w40/ua.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'TR', name: 'Turquia', dialCode: '+90', flag: 'https://flagcdn.com/w40/tr.png',
    format: '(000) 000 0000',
    mask: (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
    },
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },

  // Asia
  {
    code: 'CN', name: 'China', dialCode: '+86', flag: 'https://flagcdn.com/w40/cn.png',
    format: '000 0000 0000',
    mask: createMask('000 0000 0000'),
    validate: createValidator(11, 11), minLength: 11, maxLength: 11
  },
  {
    code: 'JP', name: 'Japao', dialCode: '+81', flag: 'https://flagcdn.com/w40/jp.png',
    format: '00 0000 0000',
    mask: createMask('00 0000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'KR', name: 'Coreia do Sul', dialCode: '+82', flag: 'https://flagcdn.com/w40/kr.png',
    format: '00 0000 0000',
    mask: createMask('00 0000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'IN', name: 'India', dialCode: '+91', flag: 'https://flagcdn.com/w40/in.png',
    format: '00000 00000',
    mask: createMask('00000 00000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'ID', name: 'Indonesia', dialCode: '+62', flag: 'https://flagcdn.com/w40/id.png',
    format: '000-0000-0000',
    mask: createMask('000-0000-0000'),
    validate: createValidator(10, 12), minLength: 10, maxLength: 12
  },
  {
    code: 'PH', name: 'Filipinas', dialCode: '+63', flag: 'https://flagcdn.com/w40/ph.png',
    format: '000 000 0000',
    mask: createMask('000 000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'TH', name: 'Tailandia', dialCode: '+66', flag: 'https://flagcdn.com/w40/th.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'VN', name: 'Vietna', dialCode: '+84', flag: 'https://flagcdn.com/w40/vn.png',
    format: '00 000 00 00',
    mask: createMask('00 000 00 00'),
    validate: createValidator(9, 10), minLength: 9, maxLength: 10
  },
  {
    code: 'MY', name: 'Malasia', dialCode: '+60', flag: 'https://flagcdn.com/w40/my.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 10), minLength: 9, maxLength: 10
  },
  {
    code: 'SG', name: 'Singapura', dialCode: '+65', flag: 'https://flagcdn.com/w40/sg.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: 'https://flagcdn.com/w40/hk.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'TW', name: 'Taiwan', dialCode: '+886', flag: 'https://flagcdn.com/w40/tw.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'PK', name: 'Paquistao', dialCode: '+92', flag: 'https://flagcdn.com/w40/pk.png',
    format: '000 0000000',
    mask: createMask('000 0000000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: 'https://flagcdn.com/w40/bd.png',
    format: '0000 000000',
    mask: createMask('0000 000000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },

  // Oriente Medio
  {
    code: 'AE', name: 'Emirados Arabes', dialCode: '+971', flag: 'https://flagcdn.com/w40/ae.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'SA', name: 'Arabia Saudita', dialCode: '+966', flag: 'https://flagcdn.com/w40/sa.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'IL', name: 'Israel', dialCode: '+972', flag: 'https://flagcdn.com/w40/il.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'QA', name: 'Qatar', dialCode: '+974', flag: 'https://flagcdn.com/w40/qa.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'KW', name: 'Kuwait', dialCode: '+965', flag: 'https://flagcdn.com/w40/kw.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'BH', name: 'Bahrein', dialCode: '+973', flag: 'https://flagcdn.com/w40/bh.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'OM', name: 'Oma', dialCode: '+968', flag: 'https://flagcdn.com/w40/om.png',
    format: '0000 0000',
    mask: createMask('0000 0000'),
    validate: createValidator(8, 8), minLength: 8, maxLength: 8
  },
  {
    code: 'EG', name: 'Egito', dialCode: '+20', flag: 'https://flagcdn.com/w40/eg.png',
    format: '00 0000 0000',
    mask: createMask('00 0000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'JO', name: 'Jordania', dialCode: '+962', flag: 'https://flagcdn.com/w40/jo.png',
    format: '0 0000 0000',
    mask: createMask('0 0000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'LB', name: 'Libano', dialCode: '+961', flag: 'https://flagcdn.com/w40/lb.png',
    format: '00 000 000',
    mask: createMask('00 000 000'),
    validate: createValidator(7, 8), minLength: 7, maxLength: 8
  },

  // Oceania
  {
    code: 'AU', name: 'Australia', dialCode: '+61', flag: 'https://flagcdn.com/w40/au.png',
    format: '0000 000 000',
    mask: createMask('0000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'NZ', name: 'Nova Zelandia', dialCode: '+64', flag: 'https://flagcdn.com/w40/nz.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 10), minLength: 9, maxLength: 10
  },

  // Africa
  {
    code: 'ZA', name: 'Africa do Sul', dialCode: '+27', flag: 'https://flagcdn.com/w40/za.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'NG', name: 'Nigeria', dialCode: '+234', flag: 'https://flagcdn.com/w40/ng.png',
    format: '000 000 0000',
    mask: createMask('000 000 0000'),
    validate: createValidator(10, 10), minLength: 10, maxLength: 10
  },
  {
    code: 'KE', name: 'Quenia', dialCode: '+254', flag: 'https://flagcdn.com/w40/ke.png',
    format: '000 000000',
    mask: createMask('000 000000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'MA', name: 'Marrocos', dialCode: '+212', flag: 'https://flagcdn.com/w40/ma.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'GH', name: 'Gana', dialCode: '+233', flag: 'https://flagcdn.com/w40/gh.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: 'https://flagcdn.com/w40/tz.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'ET', name: 'Etiopia', dialCode: '+251', flag: 'https://flagcdn.com/w40/et.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'AO', name: 'Angola', dialCode: '+244', flag: 'https://flagcdn.com/w40/ao.png',
    format: '000 000 000',
    mask: createMask('000 000 000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'MZ', name: 'Mocambique', dialCode: '+258', flag: 'https://flagcdn.com/w40/mz.png',
    format: '00 000 0000',
    mask: createMask('00 000 0000'),
    validate: createValidator(9, 9), minLength: 9, maxLength: 9
  },
  {
    code: 'CV', name: 'Cabo Verde', dialCode: '+238', flag: 'https://flagcdn.com/w40/cv.png',
    format: '000 00 00',
    mask: createMask('000 00 00'),
    validate: createValidator(7, 7), minLength: 7, maxLength: 7
  },
];

// Mapeamento de idioma para pais padrao
const LANGUAGE_TO_COUNTRY = {
  'pt': 'BR',
  'pt-BR': 'BR',
  'en': 'US',
  'en-US': 'US',
  'en-GB': 'GB',
  'es': 'ES',
  'es-ES': 'ES',
  'es-MX': 'MX',
  'fr': 'FR',
  'de': 'DE',
  'it': 'IT',
  'ja': 'JP',
  'ko': 'KR',
  'zh': 'CN',
  'ru': 'RU',
  'ar': 'SA'
};

const PhoneInput = ({
  value,
  onChange,
  countryCode,
  onCountryChange,
  placeholder,
  error,
  disabled = false,
  className = ''
}) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Determinar pais padrao para ordenacao
  const defaultCountryCode = user?.default_country || LANGUAGE_TO_COUNTRY[i18n.language] || 'BR';

  // Ordenar paises: padrao primeiro, depois alfabeticamente
  const getSortedCountries = (countries) => {
    const defaultCountry = countries.find(c => c.code === defaultCountryCode);
    const otherCountries = countries
      .filter(c => c.code !== defaultCountryCode)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return defaultCountry ? [defaultCountry, ...otherCountries] : otherCountries;
  };

  // Filtrar e ordenar paises
  const filteredCountries = searchQuery
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.dialCode.includes(searchQuery) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    : getSortedCountries(COUNTRIES);

  // Determinar pais padrao
  useEffect(() => {
    if (countryCode) {
      const country = COUNTRIES.find(c => c.code === countryCode);
      if (country) {
        setSelectedCountry(country);
        return;
      }
    }

    if (user?.default_country) {
      const country = COUNTRIES.find(c => c.code === user.default_country);
      if (country) {
        setSelectedCountry(country);
        onCountryChange?.(country.code);
        return;
      }
    }

    const langCountry = LANGUAGE_TO_COUNTRY[i18n.language] || 'BR';
    const country = COUNTRIES.find(c => c.code === langCountry) || COUNTRIES[0];
    setSelectedCountry(country);
    onCountryChange?.(country.code);
  }, [countryCode, user?.default_country, i18n.language]);

  // Focar no campo de busca quando abrir dropdown
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    onCountryChange?.(country.code);
    setIsOpen(false);
    setSearchQuery('');
    onChange('');
  };

  const handlePhoneChange = (e) => {
    if (!selectedCountry) return;
    const formatted = selectedCountry.mask(e.target.value);
    onChange(formatted);
  };

  if (!selectedCountry) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className={`flex rounded-lg border ${error ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} overflow-hidden`}>
        {/* Country Selector */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-2 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img
            src={selectedCountry.flag}
            alt={selectedCountry.name}
            className="w-5 h-4 object-cover rounded-sm"
          />
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
            {selectedCountry.dialCode}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {/* Phone Input */}
        <input
          type="tel"
          value={value}
          onChange={handlePhoneChange}
          placeholder={placeholder || selectedCountry.format}
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Country Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-72 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pais..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Countries List */}
          <div className="overflow-y-auto max-h-56">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left ${
                    selectedCountry.code === country.code ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                  }`}
                >
                  <img
                    src={country.flag}
                    alt={country.name}
                    className="w-6 h-4 object-cover rounded-sm"
                  />
                  <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                    {country.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {country.dialCode}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                Nenhum pais encontrado
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

// Funcao para validar telefone (opcional, mas se fornecido deve ser valido)
export const validatePhone = (phone, countryCode) => {
  if (!phone) return null; // Telefone nao e obrigatorio

  const country = COUNTRIES.find(c => c.code === countryCode);
  if (!country) return 'Pais invalido';

  const numbers = phone.replace(/\D/g, '');

  if (numbers.length < country.minLength) {
    return `Telefone deve ter pelo menos ${country.minLength} digitos`;
  }

  if (numbers.length > country.maxLength) {
    return `Telefone deve ter no maximo ${country.maxLength} digitos`;
  }

  if (!country.validate(phone)) {
    return 'Telefone invalido';
  }

  return null;
};

// Exportar lista de paises para uso em outros componentes
export { COUNTRIES, LANGUAGE_TO_COUNTRY };

export default PhoneInput;
