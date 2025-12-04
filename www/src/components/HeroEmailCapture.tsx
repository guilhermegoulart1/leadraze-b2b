import { useState, useEffect } from 'react';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api';

interface HeroEmailCaptureProps {
  locale?: string;
}

export default function HeroEmailCapture({ locale = 'en' }: HeroEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);

  // Translations
  const t = {
    en: {
      placeholder: 'Enter your work email',
      cta: 'Start Free Trial',
      processing: 'Processing...',
      invalidEmail: 'Please enter a valid email',
      error: 'Something went wrong. Please try again.'
    },
    'pt-br': {
      placeholder: 'Digite seu email profissional',
      cta: 'Iniciar Trial',
      processing: 'Processando...',
      invalidEmail: 'Digite um email válido',
      error: 'Algo deu errado. Tente novamente.'
    },
    es: {
      placeholder: 'Ingresa tu email profesional',
      cta: 'Iniciar Prueba',
      processing: 'Procesando...',
      invalidEmail: 'Ingresa un email válido',
      error: 'Algo salió mal. Inténtalo de nuevo.'
    }
  };

  const texts = t[locale as keyof typeof t] || t.en;

  // Capture affiliate code from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      const code = refCode.toUpperCase();
      localStorage.setItem('affiliate_ref', code);
      setAffiliateCode(code);
    } else {
      const storedCode = localStorage.getItem('affiliate_ref');
      if (storedCode) {
        setAffiliateCode(storedCode);
      }
    }
  }, []);

  // Get UTM params
  const getUtmParams = () => {
    if (typeof window === 'undefined') return {};

    const urlParams = new URLSearchParams(window.location.search);
    return {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_content: urlParams.get('utm_content'),
      utm_term: urlParams.get('utm_term'),
      referrer: document.referrer || null
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError(texts.invalidEmail);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Capture the lead first
      const utmParams = getUtmParams();

      await fetch(`${API_URL}/public/website-leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: 'hero',
          locale,
          affiliate_code: affiliateCode,
          ...utmParams
        })
      });

      // 2. Store email in localStorage for checkout
      localStorage.setItem('checkout_email', email.trim().toLowerCase());

      // 3. Redirect to checkout with email
      const response = await fetch(`${API_URL}/billing/checkout-guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraChannels: 0,
          extraUsers: 0,
          customerEmail: email.trim().toLowerCase(),
          successUrl: `${window.location.origin}/${locale !== 'en' ? locale + '/' : ''}?checkout=success`,
          cancelUrl: `${window.location.origin}/${locale !== 'en' ? locale + '/' : ''}#pricing`,
          affiliateCode: affiliateCode || undefined
        })
      });

      const data = await response.json();

      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError(data.message || texts.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(texts.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {/* Integrated input + button container */}
      <div className="relative flex items-center bg-white rounded-2xl shadow-xl shadow-gray-900/10 border border-gray-200 p-2 transition-all focus-within:border-primary-400 focus-within:shadow-primary-500/20">
        {/* Email icon */}
        <div className="pl-3 pr-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Input field */}
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder={texts.placeholder}
          className="flex-1 min-w-0 px-2 py-3 text-base bg-transparent outline-none text-gray-900 placeholder-gray-400"
          disabled={loading}
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="group flex-shrink-0 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="hidden sm:inline">{texts.processing}</span>
            </>
          ) : (
            <>
              <span>{texts.cta}</span>
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
      )}
    </form>
  );
}
