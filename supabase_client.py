import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
supabase_url = os.getenv("REACT_APP_SUPABASE_URL")
supabase_key = os.getenv("REACT_APP_SUPABASE_ANON_KEY")

# Create Supabase client
supabase = create_client(supabase_url, supabase_key)

def get_supabase_client():
    """
    Returns the Supabase client instance
    """
    return supabase
