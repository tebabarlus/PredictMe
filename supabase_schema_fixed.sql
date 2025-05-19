-- PredictMe Supabase Database Schema
-- This script sets up all necessary tables for the PredictMe application
-- Execute this in the Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if needed (uncomment if you want to reset)
-- DROP TABLE IF EXISTS predictions;
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS user_profiles;
-- DROP TABLE IF EXISTS comments;
-- DROP TABLE IF EXISTS event_engagement;
-- DROP TABLE IF EXISTS notifications;

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT UNIQUE,
    username TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reputation_score INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Authentication nonces table for wallet authentication
CREATE TABLE IF NOT EXISTS public.auth_nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_wallet_nonce UNIQUE (wallet_address, nonce)
);

-- Create indexes for auth_nonces
CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON public.auth_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_nonce ON public.auth_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON public.auth_nonces(expires_at);

-- Enable RLS on auth_nonces
ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for auth_nonces
CREATE POLICY "Users can manage their own nonces"
ON public.auth_nonces
FOR ALL
TO authenticated
USING (wallet_address = current_setting('request.jwt.claim.sub', true)::text);

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT DEFAULT 'general',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_option_id UUID,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0
);

-- Add index on category for faster filtering
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events(category);
CREATE INDEX IF NOT EXISTS events_end_time_idx ON public.events(end_time);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events(created_at);

-- Create predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    option_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount INTEGER DEFAULT 0,
    confidence_score FLOAT DEFAULT 0.5,
    UNIQUE(event_id, user_id) -- Each user can only predict once per event
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE
);

-- Create table for tracking event views/engagement
CREATE TABLE IF NOT EXISTS public.event_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    engagement_type TEXT NOT NULL -- 'view', 'share', 'bookmark', etc.
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL, -- 'event_ending', 'result_announced', 'comment', etc.
    ref_id UUID -- Reference to related entity (event, comment, etc.)
);

-- Function to create auth_nonces table if it doesn't exist
CREATE OR REPLACE FUNCTION public.create_auth_nonces_table()
RETURNS void AS $$
BEGIN
    -- Create the table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_nonces') THEN
        CREATE TABLE public.auth_nonces (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            wallet_address TEXT NOT NULL,
            nonce TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_wallet_nonce UNIQUE (wallet_address, nonce)
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON public.auth_nonces(wallet_address);
        CREATE INDEX IF NOT EXISTS idx_auth_nonces_nonce ON public.auth_nonces(nonce);
        CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON public.auth_nonces(expires_at);
        
        -- Enable RLS
        ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;
        
        -- Add RLS policies
        CREATE POLICY "Users can manage their own nonces"
        ON public.auth_nonces
        FOR ALL
        TO authenticated
        USING (wallet_address = current_setting('request.jwt.claim.sub', true)::text);
        
        RAISE NOTICE 'Created auth_nonces table';
    ELSE
        RAISE NOTICE 'auth_nonces table already exists';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index on wallet_address for faster queries
CREATE INDEX IF NOT EXISTS auth_nonces_wallet_idx ON public.auth_nonces(wallet_address);

-- Functions and triggers

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_user_profiles_timestamp
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_events_timestamp
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_comments_timestamp
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Events policies
CREATE POLICY "Events are viewable by everyone"
ON public.events FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Authenticated users can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Predictions policies
CREATE POLICY "Users can view all predictions"
ON public.predictions FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Authenticated users can create predictions"
ON public.predictions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Comments policies
CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments"
ON public.comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Event engagement policies
CREATE POLICY "Anyone can record engagement"
ON public.event_engagement FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add sample data for testing (optional - comment out for production)
INSERT INTO public.events (title, description, end_time, options, category)
VALUES 
('Will Bitcoin reach $100,000 by end of 2025?', 'Predicting whether Bitcoin will break the $100k barrier', '2025-12-31 23:59:59+00', '[{"id":"opt1", "value":"YES", "label":"Yes"}, {"id":"opt2", "value":"NO", "label":"No"}]', 'crypto'),
('Will Manchester United win the Premier League?', 'Prediction for the football season', '2026-05-30 23:59:59+00', '[{"id":"opt1", "value":"YES", "label":"Yes"}, {"id":"opt2", "value":"NO", "label":"No"}]', 'sports'),
('Will AI replace programmers by 2030?', 'Debate on the future of coding jobs', '2030-01-01 23:59:59+00', '[{"id":"opt1", "value":"YES", "label":"Yes"}, {"id":"opt2", "value":"NO", "label":"No"}]', 'technology'),
('Will there be a new global pandemic before 2028?', 'Prediction on global health crises', '2028-01-01 23:59:59+00', '[{"id":"opt1", "value":"YES", "label":"Yes"}, {"id":"opt2", "value":"NO", "label":"No"}]', 'science'),
('Next US Presidential Election Winner Party', 'Which party will win the White House', '2028-11-07 23:59:59+00', '[{"id":"opt1", "value":"DEMOCRAT", "label":"Democrat"}, {"id":"opt2", "value":"REPUBLICAN", "label":"Republican"}, {"id":"opt3", "value":"OTHER", "label":"Other"}]', 'politics');

-- Create custom functions for API
CREATE OR REPLACE FUNCTION get_trending_events(limit_count INTEGER DEFAULT 10)
RETURNS SETOF public.events AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.events
  WHERE end_time > NOW()
  ORDER BY view_count DESC, created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_events_by_category(category_filter TEXT, limit_count INTEGER DEFAULT 50)
RETURNS SETOF public.events AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.events
  WHERE category = category_filter AND end_time > NOW()
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create custom function to get user predictions
CREATE OR REPLACE FUNCTION get_user_predictions(user_id_filter UUID)
RETURNS TABLE (
  prediction_id UUID,
  event_id UUID,
  event_title TEXT,
  option_selected TEXT,
  prediction_time TIMESTAMP WITH TIME ZONE,
  event_end_time TIMESTAMP WITH TIME ZONE,
  is_resolved BOOLEAN,
  resolved_option_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as prediction_id,
    e.id as event_id,
    e.title as event_title,
    p.option_id as option_selected,
    p.created_at as prediction_time,
    e.end_time as event_end_time,
    e.is_resolved,
    e.resolved_option_id
  FROM 
    public.predictions p
  JOIN 
    public.events e ON p.event_id = e.id
  WHERE 
    p.user_id = user_id_filter
  ORDER BY 
    p.created_at DESC;
END;
$$ LANGUAGE plpgsql;