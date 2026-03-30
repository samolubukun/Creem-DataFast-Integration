'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface CreemDataFastProviderProps {
  children: ReactNode;
  apiUrl?: string;
  websiteId?: string;
  domain?: string;
}

export interface CreemDataFastTracking {
  visitorId: string | null;
  sessionId: string | null;
  ready: boolean;
}

export interface CreemDataFastContextValue {
  tracking: CreemDataFastTracking;
  getTracking: () => CreemDataFastTracking;
  attributeUrl: (url: string) => string;
  attributeHostedLink: (url: string) => string;
  refreshTracking: () => void;
}

const CreemDataFastContext = createContext<CreemDataFastContextValue | null>(null);

export function CreemDataFastProvider({
  children,
  apiUrl = '/api/events',
  websiteId,
  domain,
}: CreemDataFastProviderProps) {
  const [tracking, setTracking] = useState<CreemDataFastTracking>({
    visitorId: null,
    sessionId: null,
    ready: false,
  });

  const getTracking = useCallback((): CreemDataFastTracking => {
    if (typeof document === 'undefined') return { visitorId: null, sessionId: null, ready: false };
    const cookies = document.cookie.split(';');
    let visitorId: string | null = null;
    let sessionId: string | null = null;
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name === 'datafast_visitor_id') visitorId = valueParts.join('=') || null;
      if (name === 'datafast_session_id') sessionId = valueParts.join('=') || null;
    }
    return { visitorId, sessionId, ready: !!visitorId };
  }, []);

  const refreshTracking = useCallback(() => {
    const t = getTracking();
    setTracking(t);
  }, [getTracking]);

  useEffect(() => {
    if (websiteId && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.datafa.st/tracking.js';
      script.async = true;
      script.setAttribute('data-website-id', websiteId);
      if (domain) script.setAttribute('data-domain', domain);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [websiteId, domain]);

  useEffect(() => {
    refreshTracking();
    const interval = setInterval(refreshTracking, 1000);
    return () => clearInterval(interval);
  }, [refreshTracking]);

  const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [n, ...v] = cookie.trim().split('=');
      if (n === name) return v.join('=');
    }
    return null;
  };

  const attributeUrl = useCallback((url: string): string => {
    const vid = tracking.visitorId ?? getCookieValue('datafast_visitor_id');
    const sid = tracking.sessionId ?? getCookieValue('datafast_session_id');
    if (!vid && !sid) return url;
    try {
      const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (vid) urlObj.searchParams.set('datafast_visitor_id', vid);
      if (sid) urlObj.searchParams.set('datafast_session_id', sid);
      return urlObj.toString();
    } catch {
      return url;
    }
  }, [tracking]);

  const attributeHostedLink = useCallback((hostedUrl: string): string => {
    return attributeUrl(hostedUrl);
  }, [attributeUrl]);

  return (
    <CreemDataFastContext.Provider value={{
      tracking,
      getTracking,
      attributeUrl,
      attributeHostedLink,
      refreshTracking,
    }}>
      {children}
    </CreemDataFastContext.Provider>
  );
}

export function useCreemDataFast(): CreemDataFastContextValue {
  const context = useContext(CreemDataFastContext);
  if (!context) {
    throw new Error('useCreemDataFast must be used within CreemDataFastProvider');
  }
  return context;
}

export function useCreemDataFastTracking(): CreemDataFastTracking {
  const { tracking } = useCreemDataFast();
  return tracking;
}

export interface CreemCheckoutButtonProps {
  action?: string;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function CreemCheckoutButton({
  action = '/api/checkout',
  children = 'Checkout',
  className,
  onClick,
  disabled,
  style,
}: CreemCheckoutButtonProps) {
  const { attributeUrl } = useCreemDataFast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const resp = await fetch(action, { method: 'POST' });
      const data = await resp.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick || handleClick}
      disabled={disabled || loading}
      className={className}
      style={{
        background: disabled || loading ? '#4b5563' : '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '1rem 2rem',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {loading ? 'Processing...' : children}
    </button>
  );
}

export interface CreemPaymentLinkButtonProps {
  href: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CreemPaymentLinkButton({
  href,
  children = 'Pay with Creem',
  className,
  style,
}: CreemPaymentLinkButtonProps) {
  const { attributeHostedLink } = useCreemDataFast();

  return (
    <a
      href={attributeHostedLink(href)}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: '#9ca3af',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        padding: '1rem 1.5rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {children}
    </a>
  );
}

export interface TrackingInspectorProps {
  className?: string;
  showDetails?: boolean;
  style?: React.CSSProperties;
}

export function TrackingInspector({
  className,
  showDetails = true,
  style,
}: TrackingInspectorProps) {
  const { tracking, getTracking } = useCreemDataFast();
  const [currentTracking, setCurrentTracking] = useState(tracking);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTracking(getTracking());
    }, 500);
    return () => clearInterval(interval);
  }, [getTracking]);

  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '1rem',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showDetails ? '0.5rem' : 0 }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: currentTracking.ready ? '#10b981' : '#fbbf24',
        }} />
        <span style={{ color: currentTracking.ready ? '#10b981' : '#fbbf24' }}>
          {currentTracking.ready ? 'Tracking Ready' : 'Warming Up'}
        </span>
      </div>
      {showDetails && (
        <div style={{ color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div>Visitor: {currentTracking.visitorId?.slice(0, 16) ?? 'pending'}...</div>
          <div>Session: {currentTracking.sessionId?.slice(0, 16) ?? 'pending'}...</div>
        </div>
      )}
    </div>
  );
}

export default CreemDataFastProvider;