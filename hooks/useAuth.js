import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Create a redirect URI for Expo Go or standalone app
      const redirectTo = Linking.createURL('');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (res.type === 'success' && res.url) {
          // Supabase returns tokens in the URL hash (#)
          const queryString = res.url.split('#')[1] || res.url.split('?')[1];
          if (queryString) {
            const params = {};
            queryString.split('&').forEach(param => {
              const [key, value] = param.split('=');
              params[key] = value;
            });

            if (params.access_token && params.refresh_token) {
              await supabase.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token,
              });
            }
          }
        }
      }
      return { data, error: null };
    } catch (error) {
      console.log('Google Sign-In Error:', error);
      return { data: null, error };
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.log('Email Sign-In Error:', error);
      return { data: null, error };
    }
  };

  const signUpWithEmail = async (email, password, nickname = '') => {
    try {
      const avatarUrl = nickname ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nickname)}` : '';
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname,
            avatar_url: avatarUrl,
            full_name: nickname // Fallback
          }
        }
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.log('Email Sign-Up Error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Sign-Out Error:', error);
    }
  };

  return { user, session, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut };
};
