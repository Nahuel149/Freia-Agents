import logging
import json
import asyncio
import re
import time
import base64
import hashlib
from typing import List, Dict, Optional, Any, Tuple, Set, BinaryIO, Union
from datetime import datetime, timezone, timedelta
import py3langid as langid  # for language detection
from openai import OpenAI, AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam
from googleapiclient.discovery import build
import requests
import io
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
import openai
import numpy as np
import pytz
import pymongo
from py3langid import classify
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from fastapi import HTTPException
from openai import AsyncOpenAI, APIError

from config.database import db_analysis
from config.settings import get_settings
from models.chat import ChatMessage, ChatSession
from services.store import get_store_context, build_complete_store_context
from utils.logger import logger
from services.meta_permissions import (
    get_missing_permissions_for_chat_query, 
    is_meta_related_query,
    extract_meta_data_points,
    fetch_meta_data_for_chat,
    generate_permission_message
)
from services.meta import sync_meta_data_for_chat

# Import cost tracking service
from services.security_service import SecurityService

# Configure logging
logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()

# Initialize OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Chat collection reference
chat_collection = db_analysis["store_chats"]

# Store context cache
store_context_cache = None

# SecurityService will be injected via dependency injection
# Removed global initialization to fix async event loop error

# --- NEW: Define Personas and Intent Classification ---
PERSONA_PROMPTS = {
    "Strategy": """You are a Chief Strategy Officer with 30 years of experience in e-commerce. Analyze the user's query and the provided context from a high-level strategic perspective. Focus on long-term growth, competitive positioning, market trends, and profitability. Provide actionable, data-driven strategic recommendations.""",
    "Marketing": """You are a Marketing CEO specializing in e-commerce brands. Analyze the user's query and the provided context through a marketing lens. Focus on customer acquisition, branding, campaign effectiveness, social media engagement, SEO, and customer retention. Provide creative and data-backed marketing tactics.""",
    "Operations": """You are an E-commerce Operations Expert. Analyze the user's query and the provided context focusing on operational efficiency. Address topics like inventory management, shipping logistics, customer service, website performance, and payment processing. Provide practical advice to streamline operations.""",
    "Data Analysis": """You are a Senior Data Analyst specializing in e-commerce data. Analyze the user's query and the provided context with a focus on data interpretation. Explain metrics, identify trends, highlight statistical significance, and suggest further data exploration based *only* on the provided data.""",
    "General": """You are a helpful and knowledgeable D-Unit AI assistant. Answer the user's query clearly and concisely based on the provided context. If the query requires specific expertise, frame your answer helpfully but avoid speculation beyond the data."""
}

DEFAULT_PERSONA = "General"

async def _get_question_intent(user_message: str) -> str:
    """
    Uses a quick async LLM call to classify the user's message intent.
    """
    try:
        # Initialize Async Client for this specific async function
        # Assuming settings are available globally or via import
        from config.settings import get_settings
        settings = get_settings()
        async_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception as client_init_error:
        logger.error(f"Failed to initialize AsyncOpenAI client: {client_init_error}")
        return DEFAULT_PERSONA
        
    classification_model = settings.OPENAI_DEFAULT_MODEL  # Use configured model
    categories = list(PERSONA_PROMPTS.keys()) # Use keys from the dict
    
    system_prompt = f"Classify the user's primary question intent into one of the following categories: {', '.join(categories)}. Respond with ONLY the category name."
    
    try:
        response = await async_client.chat.completions.create( # Use async client
             model=classification_model,
             messages=[
                 {"role": "system", "content": system_prompt},
                 {"role": "user", "content": user_message}
             ],
             max_tokens=50, # Increased slightly just in case
             temperature=0.2 
        )
        # Check if response and content exist before stripping
        intent_content = response.choices[0].message.content if response.choices and response.choices[0].message else None
        intent = intent_content.strip() if intent_content else DEFAULT_PERSONA

        # Validate the response is one of the expected categories
        if intent in categories:
            logger.debug(f"Classified intent for '{user_message[:50]}...' as: {intent}")
            return intent
        else:
            logger.warning(f"LLM classification returned invalid category '{intent}'. Defaulting to {DEFAULT_PERSONA}.")
            return DEFAULT_PERSONA
    except Exception as e:
        logger.error(f"Error during question intent classification: {e}", exc_info=True)
        return DEFAULT_PERSONA # Default on error
# --- END NEW ---

async def _detect_meta_collection_query(user_query: str) -> Optional[str]:
    """
    Detect if the user query is asking about specific Meta collection data.
    
    Args:
        user_query: The user's query text
        
    Returns:
        The name of the most relevant Meta collection (e.g., "meta_posts", "meta_ad_campaigns") 
        or None if no specific Meta collection intent is detected.
    """
    query_lower = user_query.lower()
    
    # Keywords mapping to specific Meta collections
    collection_keywords = {
        "meta_posts": [
            "post", "posts", "publicaciones", "publicación", "publicacion", 
            "content", "contenido", "update", "updates", "actualización", "actualizacion"
        ],
        "meta_ad_campaigns": [
            "campaign", "campaigns", "campaña", "campana", "campaigning", "campañas", "campanas",
            "ad campaign", "advertising campaign", "marketing campaign"
        ],
        "meta_ad_metrics": [
            "ad metrics", "advertising metrics", "ad performance", "advertising performance",
            "ad spend", "ad cost", "ad roi", "ad return", "ad investment", "ad conversion",
            "métricas de anuncios", "rendimiento de anuncios", "costo de anuncios", "conversión de anuncios"
        ],
        "meta_insights": [
            "insight", "insights", "estadísticas", "estadisticas", "analytics", "analysis", "análisis", "analisis",
            "performance insights", "page insights", "trends", "tendencias"
        ],
        "meta_comments": [
            "comment", "comments", "comentario", "comentarios", "engagement", "feedback", "respuesta", "respuestas",
            "reaction", "reactions", "reacción", "reacciones", "interacción", "interacciones"
        ],
        "meta_followers": [
            "follower", "followers", "seguidor", "seguidores", "following", "follow", "audience", "audiencia",
            "fans", "subscribers", "suscriptores", "subscriptores", "follower count", "numero de seguidores", "número de seguidores"
        ],
        "meta_demographics": [
            "demographic", "demographics", "demográfico", "demografico", "demográficos", "demograficos",
            "audience breakdown", "audience data", "audience age", "audience gender", "audience location",
            "datos demográficos", "datos demograficos", "edad audiencia", "género audiencia", "ubicación audiencia"
        ]
    }
    
    # Specific phrases that might indicate a user is asking for Meta collection data
    meta_general_phrases = [
        "show me", "list", "get", "find", "retrieve", "display", "muestra", "mostrar", "lista", "listar", 
        "ver", "obtener", "dame", "encuentra", "busca", "quiero ver", "muéstrame", "how many", "cuantos", "cuántos"
    ]
    
    # Check for general Meta intent
    if not is_meta_related_query(query_lower):
        return None
    
    # First check for direct mentions of collections by name combined with action phrases
    for collection_name, keywords in collection_keywords.items():
        for keyword in keywords:
            if keyword in query_lower:
                # Check for additional context signaling data retrieval intent
                for phrase in meta_general_phrases:
                    if phrase in query_lower and keyword in query_lower:
                        logger.info(f"Detected Meta collection query intent: {collection_name} (keyword: {keyword}, phrase: {phrase})")
                        return collection_name
                
                # Also match if the keyword appears with specific data-seeking patterns
                if any(pattern in query_lower for pattern in [
                    f"my {keyword}", f"our {keyword}", f"all {keyword}", f"recent {keyword}",
                    f"last {keyword}", f"top {keyword}", f"best {keyword}", 
                    f"mis {keyword}", f"nuestros {keyword}", f"todos {keyword}", 
                    f"recientes {keyword}", f"últimos {keyword}", f"mejores {keyword}"
                ]):
                    logger.info(f"Detected Meta collection query intent: {collection_name} (keyword: {keyword} with possessive/quantifier)")
                    return collection_name

    # Check for specific question patterns about Meta data, especially counts
    # Enhanced follower count patterns
    question_patterns = [
        "how many post", "how many comment", "how many follower", "follower count",
        "cuántos post", "cuantos post", "cuántos coment", "cuantos coment", 
        "cuántos seguidor", "cuantos seguidor", "número de seguidor", "numero de seguidor",
        "what are my", "what are our", "how is my", "how is our",
        "cuáles son mis", "cuales son mis", "cuáles son nuestros", "cuales son nuestros",
        "cómo está mi", "como esta mi", "cómo está nuestro", "como esta nuestro"
    ]
    if any(pattern in query_lower for pattern in question_patterns):
        # Determine the most likely collection based on the full query
        matched_collections = []
        for collection_name, keywords in collection_keywords.items():
            for keyword in keywords:
                if keyword in query_lower:
                    # Give follower count extra weight if count-related patterns are present
                    boost = 1.0
                    if collection_name == "meta_followers" and any(p in query_lower for p in ["how many", "cuantos", "cuántos", "count", "numero", "número"]):
                        boost = 1.5 
                        logger.debug(f"Applying boost {boost} for follower count detection")
                    matched_collections.append((collection_name, keyword, boost))
        
        # If we found matches, return the one with the highest boosted score and longest keyword
        if matched_collections:
            # Sort primarily by boost factor (desc), then by keyword length (desc)
            matched_collections.sort(key=lambda x: (x[2], len(x[1])), reverse=True)
            best_match = matched_collections[0]
            logger.info(f"Detected Meta collection query using question pattern: {best_match[0]} (keyword: {best_match[1]}, boost: {best_match[2]})")
            return best_match[0]
            
    # If we get here and it's a Meta-related query but no specific collection was identified,
    # default to the general meta context rather than a specific collection
    logger.info("Meta-related query detected but no specific collection identified")
    return None

# Add language detection function
def detect_language(text: str) -> str:
    """Detect language of a text string"""
    if not text:
        return 'en'
    
    try:
        lang, _ = langid.classify(text)
        return lang
    except:
        return 'en'  # Default to English

def title_case(text: str) -> str:
    """Convert text to title case, respecting common words that should be lowercase"""
    if not text:
        return ""
    return ' '.join(word if word.lower() in ['and', 'or', 'in', 'of', 'the', 'a', 'an', 'for', 'to', 'with', 'by'] and i != 0 else word.capitalize() for i, word in enumerate(text.split()))

def datetime_handler(obj):
    if isinstance(obj, datetime):
        return obj.strftime("%Y-%m-%d %H:%M:%S")
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

async def generate_chat_summary(user_prompt: str, logger: logging.Logger, store_id: Optional[str] = None) -> str | None:
    """Generates a 5-word summary using OpenAI."""
    if not settings.OPENAI_API_KEY:
        logger.error("OpenAI API key is not configured.")
        return None
    
    # Check cost limits before making the request
    if store_id:
        cost_check = await check_cost_limits_before_request(store_id, estimated_tokens=50)
        if not cost_check.get("allowed", True):
            logger.warning(f"Chat summary request blocked due to cost limits for store {store_id}")
            return "Summary unavailable (cost limit reached)"
    
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        logger.info(f"Requesting 5-word summary for prompt: '{user_prompt[:50]}...'")
        response = await client.chat.completions.create(
            model=settings.OPENAI_DEFAULT_MODEL,  # Use configured model instead of hardcoded
            messages=[
                {"role": "system", "content": "You are an expert summarizer. Summarize the following text in exactly 5 words."},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=50,  # Allow some buffer for the 5 words
            n=1,
            stop=None,
            timeout=10  # Add a timeout
        )
        
        # Track cost after successful response with better error handling
        if store_id:
            input_tokens = getattr(response.usage, 'prompt_tokens', 0) if response.usage else 0
            output_tokens = getattr(response.usage, 'completion_tokens', 0) if response.usage else 0
            
            # If no usage data, log warning and estimate
            if input_tokens == 0 and output_tokens == 0:
                logger.warning(f"No usage data returned from OpenAI for model {settings.OPENAI_DEFAULT_MODEL}")
            
            await track_openai_cost(
                store_id=store_id,
                model=settings.OPENAI_DEFAULT_MODEL,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                function_name="chat_summary"
            )
        
        # Check if content exists before trying to strip it
        content = response.choices[0].message.content
        summary = content.strip() if content is not None else None
        
        if summary:
             logger.info(f"Generated summary: '{summary}'")
             return summary
        else:
             logger.warning("OpenAI returned an empty summary.")
             return None
    except openai.APIConnectionError as e:
        logger.error(f"OpenAI API request failed to connect: {e}")
        return None
    except openai.RateLimitError as e:
        logger.error(f"OpenAI API request exceeded rate limit: {e}")
        return None
    except openai.APIStatusError as e:
        logger.error(f"OpenAI API returned non-200 status code: {e.status_code} - {e.response}")
        return None
    except asyncio.TimeoutError:
        logger.error("OpenAI API request timed out.")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred during OpenAI summary generation: {e}")
        return None

# Helper function to search using Google Custom Search API
async def _search_with_google(query: str) -> List[Dict[str, str]]:
    """
    Search the web using Google Custom Search API
    Returns list of dictionaries containing title, link, and snippet
    """
    try:
        # Check if API key and search engine ID are configured
        if not settings.GOOGLE_CUSTOM_SEARCH_API_KEY or not settings.GOOGLE_CUSTOM_SEARCH_ENGINE_ID:
            logger.error("Google Custom Search API key or search engine ID not configured")
            return []
        
        # Create a service object for the Google Custom Search API
        service = build("customsearch", "v1", developerKey=settings.GOOGLE_CUSTOM_SEARCH_API_KEY)
        
        # Call the Custom Search API
        result = service.cse().list(
            q=query,
            cx=settings.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            num=settings.SEARCH_RESULT_COUNT
        ).execute()
        
        # Extract relevant information from search results
        search_results = []
        if "items" in result:
            for item in result["items"]:
                search_results.append({
                    "title": item.get("title", ""),
                    "link": item.get("link", ""),
                    "snippet": item.get("snippet", "")
                })
        
        return search_results
    
    except Exception as e:
        logger.error(f"Error searching with Google Custom Search: {str(e)}")
        return []

# Helper function to search using Brave Search API
async def _search_with_brave(query: str) -> List[Dict[str, str]]:
    """
    Search the web using Brave Search API
    Returns list of dictionaries containing title, link, and snippet
    """
    logger.debug(f"Entering _search_with_brave with query: {query}")
    try:
        # Check if API key is configured
        if not settings.BRAVE_SEARCH_API_KEY:
            logger.error("Brave Search API key not configured")
            return []
        
        # API endpoint
        url = "https://api.search.brave.com/res/v1/web/search"
        
        # Headers with the API key
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": settings.BRAVE_SEARCH_API_KEY
        }
        
        # Parameters for the search query
        params = {
            "q": query,
            "count": settings.SEARCH_RESULT_COUNT,
        }
        
        # Send the request
        logger.debug(f"Sending Brave Search API request: url={url}, headers={headers}, params={params}")
        response = requests.get(url, headers=headers, params=params)
        logger.debug(f"Brave Search API response status: {response.status_code}, body: {response.text[:300]}")
        
        # Check if request was successful
        if response.status_code != 200:
            logger.error(f"Brave Search API request failed with status code {response.status_code}")
            return []
        
        # Parse the JSON response
        data = response.json()
        
        # Extract relevant information from search results
        search_results = []
        if "web" in data and "results" in data["web"]:
            for item in data["web"]["results"]:
                search_results.append({
                    "title": item.get("title", ""),
                    "link": item.get("url", ""),
                    "snippet": item.get("description", "")
                })
        
        logger.debug(f"Parsed Brave search results: {search_results}")
        return search_results
    
    except Exception as e:
        logger.error(f"Error searching with Brave: {str(e)}", exc_info=True)
        return []

# Enhanced entity verification functions to prevent hallucinations
async def _extract_verified_entities_from_search(search_results: List[Dict[str, str]], query: str) -> Dict[str, List[Dict]]:
    """Extract and verify entities (people, businesses, etc.) from search results"""
    entities = {
        "people": [],
        "businesses": [],
        "social_media_accounts": []
    }
    
    # Detect if this is a social media query
    is_social_media_query = any(platform in query.lower() for platform in ["instagram", "tiktok", "youtube", "twitter", "x.com"])
    
    for i, result in enumerate(search_results):
        title = result.get("title", "")
        link = result.get("link", "")
        snippet = result.get("snippet", "")
        domain = link.split('/')[2] if '/' in link else ""
        
        # Extract Instagram handles
        if is_social_media_query:
            # Instagram patterns
            instagram_patterns = [
                r'@([a-zA-Z0-9_.]+)',  # @username format
                r'instagram\.com/([a-zA-Z0-9_.]+)',  # URL format
                r'([a-zA-Z0-9_.]+)\s*\|\s*Instagram',  # "username | Instagram" format
            ]
            
            for pattern in instagram_patterns:
                matches = re.findall(pattern, title + " " + snippet)
                for match in matches:
                    username = match.strip()
                    # Validate username (Instagram rules: 1-30 chars, letters, numbers, periods, underscores)
                    if 1 <= len(username) <= 30 and re.match(r'^[a-zA-Z0-9_.]+$', username):
                        # Check if this is from an authoritative source
                        is_verified = "instagram.com" in domain or any(
                            auth in domain for auth in ["forbes", "businessinsider", "techcrunch", "socialmediatoday"]
                        )
                        
                        entities["social_media_accounts"].append({
                            "username": username,
                            "platform": "Instagram",
                            "source_title": title,
                            "source_url": link,
                            "source_index": i + 1,
                            "verified_source": is_verified,
                            "context": snippet[:200]
                        })
        
        # Extract people names (with verification)
        # Look for patterns like "John Doe" in specific contexts
        name_patterns = [
            r'(?:influencer|creator|blogger|founder)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
            r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is an?|has|runs|manages|created)',
            r'(?:CEO|founder|owner)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
        ]
        
        for pattern in name_patterns:
            matches = re.findall(pattern, title + " " + snippet)
            for match in matches:
                name = match.strip()
                # Basic validation for names
                if len(name.split()) >= 2 and all(part.isalpha() for part in name.split()):
                    entities["people"].append({
                        "name": name,
                        "source_title": title,
                        "source_url": link,
                        "source_index": i + 1,
                        "context": snippet[:200]
                    })
        
        # Extract business names from titles and domains
        if any(indicator in domain for indicator in ["company", "business", "agency", "studio"]):
            # Extract from title
            business_name = title.split(" - ")[0].split(" | ")[0].strip()
            if business_name and len(business_name) > 3:
                entities["businesses"].append({
                    "name": business_name,
                    "domain": domain,
                    "source_url": link,
                    "source_index": i + 1
                })
    
    # Deduplicate entities
    for entity_type in entities:
        seen = set()
        unique_entities = []
        for entity in entities[entity_type]:
            key = entity.get("username") or entity.get("name")
            if key and key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        entities[entity_type] = unique_entities
    
    return entities

def _create_verified_search_context(search_results: List[Dict[str, str]], extracted_entities: Dict, query: str) -> str:
    """Create structured search context with verified entities"""
    context = f"Web search results for query: '{query}'\n\n"
    
    # Add verified entities section
    context += "=== VERIFIED ENTITIES (Only mention these) ===\n\n"
    
    if extracted_entities["social_media_accounts"]:
        context += "SOCIAL MEDIA ACCOUNTS:\n"
        for acc in extracted_entities["social_media_accounts"]:
            verification_status = "✓ Verified Source" if acc["verified_source"] else "From Search Result"
            context += f"- @{acc['username']} ({acc['platform']}) [{verification_status}]\n"
            context += f"  Source: {acc['source_title']} (Result #{acc['source_index']})\n"
            context += f"  URL: {acc['source_url']}\n"
            context += f"  Context: {acc['context']}\n\n"
    
    if extracted_entities["people"]:
        context += "\nPEOPLE:\n"
        for person in extracted_entities["people"]:
            context += f"- {person['name']}\n"
            context += f"  Source: {person['source_title']} (Result #{person['source_index']})\n"
            context += f"  URL: {person['source_url']}\n"
            context += f"  Context: {person['context']}\n\n"
    
    if extracted_entities["businesses"]:
        context += "\nBUSINESSES:\n"
        for biz in extracted_entities["businesses"]:
            context += f"- {biz['name']} ({biz['domain']})\n"
            context += f"  Source URL: {biz['source_url']} (Result #{biz['source_index']})\n\n"
    
    if not any(extracted_entities.values()):
        context += "No specific people, businesses, or social media accounts were found in the search results.\n"
        context += "Please inform the user and suggest refining their search query.\n"
    
    context += "\n=== SEARCH RESULTS ===\n\n"
    
    # Add numbered search results for reference
    for i, result in enumerate(search_results, 1):
        context += f"Result #{i}:\n"
        context += f"Title: {result.get('title', '')}\n"
        context += f"URL: {result.get('link', '')}\n"
        context += f"Domain: {result.get('link', '').split('/')[2] if '/' in result.get('link', '') else 'Unknown'}\n"
        context += f"Description: {result.get('snippet', '')}\n\n"
    
    return context

async def _verify_response_entities(response: str, verified_entities: Dict) -> str:
    """Enhanced post-processing to ensure only verified entities are mentioned"""
    # Create comprehensive sets of verified names/usernames
    verified_names = set()
    verified_usernames = set()
    verified_businesses = set()
    
    for acc in verified_entities.get("social_media_accounts", []):
        verified_names.add(f"@{acc['username']}")
        verified_names.add(acc['username'])
        verified_usernames.add(acc['username'])
    
    for person in verified_entities.get("people", []):
        verified_names.add(person['name'])
        # Also add individual parts of the name for more flexible matching
        name_parts = person['name'].split()
        if len(name_parts) >= 2:
            verified_names.add(f"{name_parts[0]} {name_parts[-1]}")  # First and last name
    
    for biz in verified_entities.get("businesses", []):
        verified_businesses.add(biz['name'])
        verified_names.add(biz['name'])
    
    # Enhanced pattern matching for potential hallucinations
    potential_hallucinations = []
    modifications_made = []
    
    # 1. Check for @mentions that aren't verified
    at_mentions = re.findall(r'@([a-zA-Z0-9_.]+)', response)
    for mention in at_mentions:
        if mention not in verified_usernames and mention not in verified_names:
            potential_hallucinations.append(f"@{mention}")
    
    # 2. Check for suspicious Instagram-style usernames without @
    instagram_usernames = re.findall(r'\b([a-zA-Z0-9_.]{3,30})\b(?:\s+(?:on Instagram|Instagram account|Instagram profile))', response)
    for username in instagram_usernames:
        if username not in verified_usernames and f"@{username}" not in verified_names:
            potential_hallucinations.append(username)
    
    # 3. Check for capitalized names that look like proper nouns (potential people)
    potential_names = re.findall(r'\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', response)
    for name in potential_names:
        # Skip common words and phrases
        if name.lower() not in ['instagram account', 'social media', 'business owner', 'content creator', 'new york', 'los angeles']:
            if name not in verified_names:
                # Check if it's mentioned in context that suggests it's a person
                name_context = response.lower()
                person_indicators = ['influencer', 'creator', 'blogger', 'founder', 'ceo', 'owner', 'runs', 'manages', 'created']
                if any(indicator in name_context for indicator in person_indicators):
                    potential_hallucinations.append(name)
    
    # 4. Check for specific follower counts or statistics not in search results
    follower_claims = re.findall(r'(\d+(?:,\d+)*(?:\.\d+)?[KMB]?\s+followers?)', response, re.IGNORECASE)
    for claim in follower_claims:
        # This is a basic check - in a real implementation, you'd cross-reference with search results
        logger.info(f"Found follower claim: {claim} - should verify against search results")
    
    # Process hallucinations
    if potential_hallucinations:
        logger.warning(f"Potential hallucinated entities detected: {potential_hallucinations}")
        
        modified_response = response
        for hallucination in potential_hallucinations:
            # More sophisticated replacement patterns
            patterns_to_replace = [
                (f"@{hallucination}", "[username removed - not verified]"),
                (f"{hallucination} on Instagram", "[account removed - not verified]"),
                (f"{hallucination} Instagram", "[account removed - not verified]"),
                (hallucination, "[name removed - not verified]")
            ]
            
            for pattern, replacement in patterns_to_replace:
                if pattern in modified_response:
                    modified_response = modified_response.replace(pattern, replacement)
                    modifications_made.append(pattern)
        
        # Add appropriate disclaimers based on what was modified
        if modifications_made:
            if any("@" in mod or "Instagram" in mod for mod in modifications_made):
                modified_response += "\n\n*Note: Some social media accounts mentioned were removed as they could not be verified in the search results.*"
            else:
                modified_response += "\n\n*Note: Some names were removed as they could not be verified in the search results.*"
        
        return modified_response
    
    return response

async def _validate_search_response_quality(response: str, search_results: List[Dict], query: str) -> Tuple[str, List[str]]:
    """Additional validation to ensure response quality and prevent common hallucination patterns"""
    warnings = []
    validated_response = response
    
    # Check for citation compliance
    citation_patterns = [
        r'According to [^,]+,',
        r'As reported by [^,]+,',
        r'As found on [^,]+,',
        r'Based on [^,]+,',
        r'From Result #\d+',
    ]
    
    has_citations = any(re.search(pattern, response) for pattern in citation_patterns)
    
    # If the response makes specific claims but has no citations, add warning
    specific_claim_patterns = [
        r'\d+(?:,\d+)*(?:\.\d+)?[KMB]?\s+followers?',  # Follower counts
        r'founded in \d{4}',  # Founding dates
        r'born in \d{4}',  # Birth years
        r'age \d+',  # Specific ages
        r'\$\d+(?:,\d+)*(?:\.\d+)?[KMB]?\s+(?:revenue|income|worth)',  # Financial figures
    ]
    
    has_specific_claims = any(re.search(pattern, response, re.IGNORECASE) for pattern in specific_claim_patterns)
    
    if has_specific_claims and not has_citations:
        warnings.append("Response contains specific claims without proper citations")
        validated_response += "\n\n*Note: Please verify any specific statistics or claims mentioned above, as they may require additional fact-checking.*"
    
    # Check if response mentions the query wasn't found in results
    if "not found" in response.lower() or "no results" in response.lower():
        # This is good - the AI is being honest about limitations
        pass
    
    # Check for vague or hedge language (good for uncertainty)
    hedge_indicators = ['appears to', 'seems to', 'might be', 'could be', 'possibly', 'reportedly']
    has_hedging = any(indicator in response.lower() for indicator in hedge_indicators)
    
    if not has_hedging and has_specific_claims:
        warnings.append("Response makes definitive claims without hedging language")
    
    return validated_response, warnings

def _score_source_reliability(url: str, title: str, snippet: str) -> float:
    """Score the reliability of a search result source"""
    score = 0.5  # Base score
    domain = url.split('/')[2] if '/' in url else ""
    
    # High-reliability domains
    high_reliability_domains = [
        'instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com',
        'forbes.com', 'businessinsider.com', 'techcrunch.com', 'reuters.com',
        'bloomberg.com', 'wsj.com', 'nytimes.com', 'bbc.com', 'cnn.com',
        'wikipedia.org', 'wikidata.org'
    ]
    
    # Medium-reliability domains
    medium_reliability_domains = [
        'socialmediatoday.com', 'adweek.com', 'marketingland.com',
        'influencermarketinghub.com', 'socialbakers.com', 'sproutsocial.com',
        'hootsuite.com', 'buffer.com', 'later.com'
    ]
    
    # Low-reliability indicators
    low_reliability_indicators = [
        'blogspot.com', 'wordpress.com', 'medium.com', 'tumblr.com',
        'angelfire', 'geocities', 'freewebsites', 'weebly.com', 'wix.com'
    ]
    
    # Domain-based scoring
    if any(trusted in domain for trusted in high_reliability_domains):
        score += 0.4
    elif any(medium in domain for medium in medium_reliability_domains):
        score += 0.2
    elif any(low in domain for low in low_reliability_indicators):
        score -= 0.3
    
    # Official social media profiles get higher scores
    if 'instagram.com' in domain and '/p/' not in url:  # Profile, not post
        score += 0.3
    if 'linkedin.com' in domain and '/in/' in url:  # LinkedIn profile
        score += 0.3
    
    # Content quality indicators
    title_lower = title.lower()
    snippet_lower = snippet.lower()
    
    # Positive indicators
    quality_indicators = [
        'verified', 'official', 'biography', 'profile', 'about',
        'company', 'organization', 'founder', 'ceo', 'established'
    ]
    
    if any(indicator in title_lower or indicator in snippet_lower for indicator in quality_indicators):
        score += 0.1
    
    # Negative indicators
    spam_indicators = [
        'click here', 'amazing', 'incredible', 'shocking', 'you won\'t believe',
        'secret', 'trick', 'hack', 'leaked', 'exposed', 'scandal'
    ]
    
    if any(spam in title_lower or spam in snippet_lower for spam in spam_indicators):
        score -= 0.2
    
    # Recent content gets slight boost (if we can detect dates)
    current_year = datetime.now().year
    for year in [current_year, current_year - 1]:
        if str(year) in snippet:
            score += 0.05
            break
    
    # Clamp score between 0 and 1
    return max(0.0, min(1.0, score))

def _filter_and_rank_search_results(search_results: List[Dict[str, str]], min_reliability_score: float = 0.3) -> List[Dict[str, str]]:
    """Filter and rank search results by reliability score"""
    if not search_results:
        return search_results
    
    # Score all results
    scored_results = []
    for result in search_results:
        score = _score_source_reliability(
            result.get('link', ''), 
            result.get('title', ''), 
            result.get('snippet', '')
        )
        
        if score >= min_reliability_score:
            result_with_score = result.copy()
            result_with_score['reliability_score'] = str(score)
            scored_results.append(result_with_score)
        else:
            logger.debug(f"Filtered out low-reliability result: {result.get('title', '')} (score: {score:.2f})")
    
    # Sort by reliability score (descending)
    scored_results.sort(key=lambda x: float(x['reliability_score']), reverse=True)
    
    # Remove the score from the final results (keep it for logging)
    for result in scored_results:
        logger.debug(f"Including result: {result.get('title', '')} (reliability: {float(result['reliability_score']):.2f})")
        del result['reliability_score']
    
    return scored_results

# Helper function for embedding-based context retrieval
async def _search_with_embeddings(query: str, store_id: str, limit: int = 8, prioritized_collection: Optional[str] = None) -> List[Dict]:
    """
    Search for relevant documents using embeddings.
    Now optimized to use MongoDB Atlas Vector Search when available, with fallback to original method.
    """
    logger.info(f"Starting embedding search for query: '{query[:50]}...' (store: {store_id})")
    
    try:
        # Try the optimized vector search first
        return await _search_with_vector_search(query, store_id, limit, prioritized_collection)
    except Exception as e:
        logger.warning(f"Vector search failed, falling back to original method: {str(e)}")
        # Fall back to the original method if the optimized version fails
        return await _search_with_embeddings_original(query, store_id, limit, prioritized_collection)

async def _search_with_embeddings_original(query: str, store_id: str, limit: int = 8, prioritized_collection: Optional[str] = None) -> List[Dict]:
    """
    Original embedding search implementation (pre-vector search optimization).
    This is the fallback method when vector search is not available.
    """
    from config.database import db_analysis
    from config.settings import get_settings
    from openai import AsyncClient as AsyncOpenAI
    import numpy as np
    
    logger.info(f"Using original embedding search for query: '{query[:50]}...' (store: {store_id})")
    
    try:
        settings = get_settings()
        
        # Check if OpenAI API key is configured
        if not settings.OPENAI_API_KEY:
            logger.error("OpenAI API key not configured for embedding search")
            return []

        # Create OpenAI client
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Check if query is likely about products or meta
        query_lower = query.lower()
        is_product_query = any(term in query_lower for term in [
            "producto", "products", "product", "item", "artículo", "articulo",
            "lentes", "lens", "glasses", "shirt", "polera", "ropa", "clothing",
            "stock", "inventory", "precio", "price", "costo", "cost", "cuanto", "how much"
        ])
        # Simple meta query detection
        is_meta_query_flag = any(keyword in query_lower for keyword in [
            "facebook", "instagram", "meta", "follower", "campaign", "ad", "social", "post", "engagement"
        ])

        # Generate embedding for the query
        try:
            logger.info(f"Generating embedding for query: '{query[:50]}...'")
            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=query,
                dimensions=512,
                encoding_format="float"
            )
            query_embedding = response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating embedding for query: {str(e)}")
            return []

        # Base target collections
        target_collections = [
            "product_details_cache_embeddings",
            "store_customers_cache_embeddings",
            "active_stores_cache_embeddings",
            "global_analysis_embeddings",
            "store_activity_metrics_embeddings",
            "platform_reference_data_embeddings"
        ]

        # Add Meta collections if it's a meta query
        if is_meta_query_flag:
            meta_collections = [
                "meta_pages_embeddings",
                "meta_posts_embeddings",
                "meta_ad_campaigns_embeddings",
                "meta_ad_metrics_embeddings",
                "meta_insights_embeddings",
                "meta_comments_embeddings",
                "meta_followers_embeddings",
                "meta_demographics_embeddings",
                "meta_sales_correlation_embeddings"
            ]
            target_collections.extend(meta_collections)
            logger.info("Meta-related query detected, including Meta embedding collections in search.")

        # Prioritize product collection for product queries
        if is_product_query and "product_details_cache_embeddings" in target_collections:
            target_collections.remove("product_details_cache_embeddings")
            target_collections.insert(0, "product_details_cache_embeddings")
            logger.info("Product-related query detected, prioritizing product details collection")
            
        # Prioritize specific collection if requested
        if prioritized_collection and prioritized_collection + "_embeddings" in target_collections:
            prioritized_embedding_collection = prioritized_collection + "_embeddings"
            logger.info(f"Prioritizing requested collection: {prioritized_embedding_collection}")
            
            if prioritized_embedding_collection in target_collections:
                target_collections.remove(prioritized_embedding_collection)
                target_collections.insert(0, prioritized_embedding_collection)

        all_results = []
        query_embedding_np = np.array(query_embedding)

        for collection_name in target_collections:
            collection = db_analysis[collection_name]
            
            try:
                # Simplified approach: Find documents with embeddings for the store
                async for doc in collection.find({"store_id": store_id}).limit(3):
                    if doc and "embedding" in doc and isinstance(doc["embedding"], list):
                        store_embedding = np.array(doc["embedding"])
                        
                        # Ensure embeddings have compatible shapes
                        if store_embedding.shape == query_embedding_np.shape:
                            similarity = float(np.dot(store_embedding, query_embedding_np) / 
                                             (np.linalg.norm(store_embedding) * np.linalg.norm(query_embedding_np)))

                            # Calculate boost factor based on priorities
                            boost_factor = 1.0
                            if is_product_query and collection_name == "product_details_cache_embeddings":
                                boost_factor *= 1.2
                            elif is_meta_query_flag and collection_name.startswith("meta_"):
                                boost_factor *= 1.15
                            if prioritized_collection and collection_name == (prioritized_collection + "_embeddings"):
                                boost_factor *= 1.25
                                logger.info(f"Applied additional boost for prioritized collection {collection_name}")
                            if boost_factor != 1.0:
                                original_similarity = similarity
                                similarity *= boost_factor
                                logger.info(f"Applied similarity boost for collection '{collection_name}' (original: {original_similarity:.4f}, boosted: {similarity:.4f})")
                            all_results.append({
                                "_id": doc.get("_id"),
                                "collection": collection_name,
                                "similarity": similarity
                            })
                        else:
                            logger.warning(f"Embedding shape mismatch in collection {collection_name} for doc {doc.get('_id')}")

            except Exception as find_exc:
                logger.error(f"Error querying collection {collection_name}: {find_exc}")
                continue

        # Sort results by similarity
        all_results.sort(key=lambda x: x["similarity"], reverse=True)
        # Take top results and ensure prioritized collection representation
        top_results_preliminary = all_results[:limit]
        if prioritized_collection:
            prioritized_embedding_collection = prioritized_collection + "_embeddings"
            prioritized_result = next((r for r in all_results if r["collection"] == prioritized_embedding_collection), None)
            is_prioritized_in_top = any(r["collection"] == prioritized_embedding_collection for r in top_results_preliminary)
            if prioritized_result and not is_prioritized_in_top and len(top_results_preliminary) >= limit:
                top_results = top_results_preliminary[:-1] + [prioritized_result]
                top_results.sort(key=lambda x: x["similarity"], reverse=True)
                logger.info(f"Forced inclusion of prioritized collection {prioritized_embedding_collection}")
            else:
                top_results = top_results_preliminary
        elif is_product_query:
            product_details_result = next((r for r in all_results if r["collection"] == "product_details_cache_embeddings"), None)
            is_product_in_top = any(r["collection"] == "product_details_cache_embeddings" for r in top_results_preliminary)
            if product_details_result and not is_product_in_top and len(top_results_preliminary) >= limit:
                top_results = top_results_preliminary[:-1] + [product_details_result]
                top_results.sort(key=lambda x: x["similarity"], reverse=True)
            else:
                top_results = top_results_preliminary
        else:
            top_results = top_results_preliminary
        # Enrich results with actual document content
        enriched_results = await _enrich_search_results(top_results)
        logger.info(f"Original embedding search completed with {len(enriched_results)} enriched results")
        return enriched_results
    except Exception as e:
        logger.error(f"Error in original embedding search: {str(e)}", exc_info=True)
        return []

async def _search_with_vector_search(query: str, store_id: str, limit: int = 8, prioritized_collection: Optional[str] = None) -> List[Dict]:
    """
    Optimized embedding search using MongoDB Atlas Vector Search.
    Falls back to the original method if vector search is not available.
    """
    try:
        from config.database import db_analysis
        import openai
        import numpy as np
        
        logger.info(f"Starting optimized vector search for query: '{query[:50]}...' (store: {store_id})")
        
        # Generate embedding for the query using OpenAI API
        client = openai.AsyncClient()
        response = await client.embeddings.create(
            input=query,
            model="text-embedding-3-small"
        )
        query_embedding = response.data[0].embedding
        
        # Determine query type for scoring boost
        is_product_query = any(keyword in query.lower() for keyword in ["product", "item", "inventory", "stock", "price", "catalog"])
        is_meta_query_flag = any(keyword in query.lower() for keyword in ["facebook", "instagram", "meta", "follower", "campaign", "ad", "social", "post", "engagement"])
        
        # Define embedding collections to search with their boost factors
        embedding_collections = [
            {"name": "product_details_cache_embeddings", "boost": 1.2 if is_product_query else 1.0},
            {"name": "meta_pages_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "meta_posts_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "meta_ad_campaigns_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "meta_ad_metrics_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "meta_followers_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "meta_demographics_embeddings", "boost": 1.15 if is_meta_query_flag else 1.0},
            {"name": "store_customers_cache_embeddings", "boost": 1.0},
            {"name": "global_analysis_embeddings", "boost": 1.0},
        ]
        
        # Apply additional boost for prioritized collection
        if prioritized_collection:
            prioritized_embedding_collection = prioritized_collection + "_embeddings"
            for collection in embedding_collections:
                if collection["name"] == prioritized_embedding_collection:
                    collection["boost"] *= 1.25
                    logger.info(f"Applied additional boost for prioritized collection {prioritized_embedding_collection}")
                    break
        
        all_results = []
        
        # Try MongoDB Atlas Vector Search first
        vector_search_available = True
        
        for collection_info in embedding_collections:
            collection_name = collection_info["name"]
            boost_factor = collection_info["boost"]
            collection = db_analysis[collection_name]
            
            try:
                # MongoDB Atlas Vector Search aggregation pipeline
                vector_search_pipeline = [
                    {
                        "$vectorSearch": {
                            "index": f"{collection_name}_vector_index",  # Assumes vector indexes are named this way
                            "path": "embedding",
                            "queryVector": query_embedding,
                            "numCandidates": limit * 3,  # Search more candidates for better results
                            "limit": limit
                        }
                    },
                    {
                        "$match": {
                            "store_id": store_id  # Filter by store_id after vector search
                        }
                    },
                    {
                        "$addFields": {
                            "similarity": {"$meta": "vectorSearchScore"}
                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "similarity": 1,
                            "store_id": 1
                        }
                    }
                ]
                
                # Execute vector search
                cursor = collection.aggregate(vector_search_pipeline)
                results = await cursor.to_list(length=limit)
                
                if results:
                    logger.info(f"Vector search returned {len(results)} results for collection {collection_name}")
                    
                    # Apply boost factor and add to results
                    for result in results:
                        original_similarity = result["similarity"]
                        boosted_similarity = original_similarity * boost_factor
                        
                        all_results.append({
                            "_id": result["_id"],
                            "collection": collection_name,
                            "similarity": boosted_similarity
                        })
                        
                        if boost_factor != 1.0:
                            logger.debug(f"Applied boost for {collection_name}: {original_similarity:.4f} -> {boosted_similarity:.4f}")
                
            except Exception as vector_search_error:
                logger.warning(f"Vector search failed for collection {collection_name}: {str(vector_search_error)}")
                
                # If this is the first collection and vector search fails, fall back to the original method
                if collection_name == embedding_collections[0]["name"]:
                    vector_search_available = False
                    logger.info("Vector search not available, falling back to original embedding search method")
                    return await _search_with_embeddings_fallback(query, store_id, limit, prioritized_collection)
        
        if not all_results:
            logger.warning("No results from vector search, falling back to original method")
            return await _search_with_embeddings_fallback(query, store_id, limit, prioritized_collection)
        
        # Sort results by similarity score
        all_results.sort(key=lambda x: x["similarity"], reverse=True)
        
        # Take top results but ensure prioritized collection representation
        top_results = all_results[:limit]
        
        # Handle prioritized collection inclusion
        if prioritized_collection:
            prioritized_embedding_collection = prioritized_collection + "_embeddings"
            prioritized_result = next((r for r in all_results if r["collection"] == prioritized_embedding_collection), None)
            is_prioritized_in_top = any(r["collection"] == prioritized_embedding_collection for r in top_results)
            
            if prioritized_result and not is_prioritized_in_top and len(top_results) >= limit:
                top_results = top_results[:-1] + [prioritized_result]
                top_results.sort(key=lambda x: x["similarity"], reverse=True)
                logger.info(f"Forced inclusion of prioritized collection {prioritized_embedding_collection}")
        
        # Enrich results with actual document content
        enriched_results = await _enrich_search_results(top_results)
        
        logger.info(f"Vector search completed successfully with {len(enriched_results)} enriched results")
        return enriched_results
        
    except Exception as e:
        logger.error(f"Error in vector search: {str(e)}")
        logger.info("Falling back to original embedding search method")
        return await _search_with_embeddings_fallback(query, store_id, limit, prioritized_collection)

async def _search_with_embeddings_fallback(query: str, store_id: str, limit: int = 8, prioritized_collection: Optional[str] = None) -> List[Dict]:
    """
    Fallback method for embedding search when vector search is not available.
    This calls the original implementation.
    """
    logger.info("Vector search failed, using original embedding search method as fallback")
    return await _search_with_embeddings_original(query, store_id, limit, prioritized_collection)

async def _enrich_search_results(top_results: List[Dict]) -> List[Dict]:
    from config.database import db_analysis
    from bson import ObjectId

    # Map embedding collection names to their source data collections
    source_collection_map = {
        "product_details_cache_embeddings": "product_details_cache",
        "store_customers_cache_embeddings": "store_customers_cache",
        "active_stores_cache_embeddings": "active_stores_cache",
        "global_analysis_embeddings": "global_analysis",
        "store_activity_metrics_embeddings": "store_activity_metrics",
        "platform_reference_data_embeddings": "platform_reference_data",
        "meta_pages_embeddings": "meta_pages",
        "meta_posts_embeddings": "meta_posts",
        "meta_ad_campaigns_embeddings": "meta_ad_campaigns",
        "meta_ad_metrics_embeddings": "meta_ad_metrics",
        "meta_insights_embeddings": "meta_insights",
        "meta_comments_embeddings": "meta_comments",
        "meta_followers_embeddings": "meta_followers",
        "meta_demographics_embeddings": "meta_demographics",
        "meta_sales_correlation_embeddings": "meta_sales_correlation",
    }

    enriched_results = []
    processed_doc_ids = set()

    for result in top_results:
        try:
            source_collection_name = source_collection_map.get(result["collection"])
            if not source_collection_name:
                logger.warning(f"No source collection mapping found for embedding collection: {result['collection']}")
                continue

            source_collection = db_analysis[source_collection_name]
            doc_id = result["_id"]

            # Skip if this source document was already added
            source_doc_key = (source_collection_name, str(doc_id))
            if source_doc_key in processed_doc_ids:
                continue

            # Handle ObjectId conversion
            try:
                if not isinstance(doc_id, ObjectId):
                    if isinstance(doc_id, str) and len(doc_id) == 24:
                        try:
                            doc_id = ObjectId(doc_id)
                        except Exception:
                            pass  # Keep as string if conversion fails
            except ImportError:
                pass  # bson not available, proceed with original doc_id type

            # Fetch the source document
            source_doc = await source_collection.find_one({"_id": doc_id})

            if not source_doc:
                logger.warning(f"Source document with ID {doc_id} not found in collection {source_collection_name}")
                continue

            # Determine document type
            doc_type = source_collection_name.replace("_cache", "").replace("_embeddings", "")

            enriched_results.append({
                "content": source_doc,
                "similarity": result["similarity"],
                "type": doc_type,
                "id": str(doc_id)
            })
            processed_doc_ids.add(source_doc_key)

        except Exception as e:
            logger.error(f"Error fetching source document for ID {result.get('_id')} from {result.get('collection')}: {str(e)}")
            continue

    # Final sort by similarity
    enriched_results.sort(key=lambda x: x["similarity"], reverse=True)
    return enriched_results

# Process default request with GPT-4.1-mini
async def _process_default_request(message: str, image_data: Optional[bytes], conversation_history: List[Dict], system_message: Dict, user_langcode: str = 'en', store_id: Optional[str] = None) -> str:
    """Process a default chat request using GPT-4.1-mini"""
    logger.debug("Processing default chat request")
    
    # Check cost limits before making the request
    if store_id:
        estimated_tokens = len(message) // 4 + 1000  # Rough estimate
        cost_check = await check_cost_limits_before_request(store_id, estimated_tokens)
        if not cost_check.get("allowed", True):
            logger.warning(f"Chat request blocked due to cost limits for store {store_id}")
            return f"I'm sorry, but your daily or monthly AI usage limit has been reached. Current usage: ${cost_check.get('current_daily_cost', 0):.4f} daily, ${cost_check.get('current_monthly_cost', 0):.4f} monthly. Limits: ${cost_check.get('daily_limit', 0):.2f} daily, ${cost_check.get('monthly_limit', 0):.2f} monthly."
    
    try:
        # Format messages for the API
        formatted_messages: List[ChatCompletionMessageParam] = []
        
        # Add system message
        formatted_messages.append(ChatCompletionSystemMessageParam(role="system", content=system_message["content"]))
        
        # Add conversation history
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                formatted_messages.append(ChatCompletionUserMessageParam(role=role, content=content))
            elif role == "assistant":
                # Ensure content is not None before adding
                if content is not None:
                   formatted_messages.append(ChatCompletionAssistantMessageParam(role=role, content=content))
            # Add other roles like 'system' if they appear in history
            elif role == "system":
                formatted_messages.append(ChatCompletionSystemMessageParam(role=role, content=content))
        
        # Add the current message from the user
        if image_data:
            content_parts: List[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
                ChatCompletionContentPartTextParam(type="text", text=message),
                ChatCompletionContentPartImageParam(
                    type="image_url", 
                    image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"}
                )
            ]
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=content_parts))
        else:
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=message))
        
        logger.debug("Calling OpenAI API for default request")
        response = client.chat.completions.create(
            model=settings.OPENAI_DEFAULT_MODEL,
            messages=formatted_messages,
            temperature=0.7,
            max_tokens=4096,
        )
        logger.debug("Received response from OpenAI for default request")
        
        # Track cost after successful response
        if store_id:
            input_tokens = getattr(response.usage, 'prompt_tokens', 0) if response.usage else 0
            output_tokens = getattr(response.usage, 'completion_tokens', 0) if response.usage else 0
            
            # If no usage data, log warning and estimate
            if input_tokens == 0 and output_tokens == 0:
                logger.warning(f"No usage data returned from OpenAI for model {settings.OPENAI_DEFAULT_MODEL}")
            
            await track_openai_cost(
                store_id=store_id,
                model=settings.OPENAI_DEFAULT_MODEL,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                function_name="chat_default"
            )
        
        response_content = response.choices[0].message.content
        return response_content if response_content is not None else "Sorry, I encountered an issue generating a response."
    except Exception as e:
        logger.error(f"Error in _process_default_request: {str(e)}", exc_info=True)
        return f"Sorry, I encountered an error while processing your request. Please try again later."

# Process think request with o4-mini
async def _process_think_request(message: str, image_data: Optional[bytes], conversation_history: List[Dict], system_message: Dict, user_langcode: str = 'en') -> str:
    """Process a 'think' mode chat request using o4-mini"""
    logger.debug("Entering _process_think_request")
    try:
        logger.debug(f"System message for Think: {system_message}")
        # Format messages for the API
        formatted_messages: List[ChatCompletionMessageParam] = []
        # Add system message
        formatted_messages.append(ChatCompletionSystemMessageParam(role="system", content=system_message.get("content", "")))
        # Add conversation history
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                formatted_messages.append(ChatCompletionUserMessageParam(role=role, content=content))
            elif role == "assistant":
                if content is not None:
                   formatted_messages.append(ChatCompletionAssistantMessageParam(role=role, content=content))
            elif role == "system":
                formatted_messages.append(ChatCompletionSystemMessageParam(role=role, content=content))
        logger.debug(f"Formatted messages for Think: {formatted_messages}")
        # Add the current message from the user
        if image_data:
            content_parts: List[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
                ChatCompletionContentPartTextParam(type="text", text=message),
                ChatCompletionContentPartImageParam(
                    type="image_url", 
                    image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"}
                )
            ]
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=content_parts))
        else:
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=message))
        logger.debug("Calling OpenAI API for Think mode")
        response = client.chat.completions.create(
            model=settings.OPENAI_THINK_MODEL,
            messages=formatted_messages,
            # Temperature parameter removed as o4-mini model only supports default temperature (1.0)
            max_completion_tokens=4096,  # Allow more tokens for deeper thinking
        )
        logger.debug("Received response from OpenAI for Think mode")
        response_content = response.choices[0].message.content
        return response_content if response_content is not None else "Sorry, I encountered an issue generating a response."
    except Exception as e:
        logger.error(f"Error in _process_think_request: {str(e)}", exc_info=True)
        return f"Sorry, I encountered an error while processing your 'Think' mode request. Please try again later."

# Additional Safety Measures

async def is_safe_for_people_search(query: str) -> bool:
    """Check if a query about people/influencers should use strict mode"""
    people_indicators = [
        "influencer", "blogger", "creator", "instagram", "tiktok", 
        "youtube", "social media", "profile", "account", "handle",
        "followers", "who is", "recommend me", "find me"
    ]
    return any(indicator in query.lower() for indicator in people_indicators)

NO_INFLUENCERS_FOUND_TEMPLATE = """
I searched for {query_description} but didn't find specific influencer profiles or social media handles in my search results.

Here's how you can find real influencers for your needs:

**Direct Platform Search:**
- Instagram: Search hashtags like {suggested_hashtags}
- TikTok: Browse {location} creator tags
- LinkedIn: Search for "{industry} content creator {location}"

**Influencer Discovery Tools:**
- Free: Social Blade (for basic stats)
- Paid: HypeAuditor, AspireIQ, Klear (filter by location + niche)

**Local Networking:**
- Contact local PR agencies
- Ask your customers for recommendations
- Join {location} business Facebook groups

**Start Small:**
- Begin with nano-influencers (1K-10K followers)
- Look for high engagement over high followers
- Test with product gifting before paid partnerships

Would you like help with:
- Creating an influencer outreach template?
- Setting up tracking for influencer campaigns?
- Developing a content brief for collaborations?
"""

HALLUCINATION_PATTERNS = {
    "fake_handles": r'@[a-zA-Z0-9_.]+',
    "fake_metrics": r'\b\d+[kKmM]?\s*(?:followers?|likes?|views?|engagement)\b',
    "fake_percentages": r'\b\d+(?:\.\d+)?%\s*(?:engagement|reach|Uruguay|audience)\b',
    "fake_demographics": r'\b\d+%\s*(?:Uruguay|Argentina|women|men|age)\b',
    "specific_ages": r'\b\d+[-–]\d+\s*(?:y\.o\.|years old|años)\b',
    "fake_descriptions": r'(?:fashion|travel|lifestyle|beauty)\s*(?:blogger|influencer|creator)',
}

# Add this to the system message for ALL deepsearch requests involving people/influencers
STRICT_ANTI_HALLUCINATION_SYSTEM_PROMPT = """
CRITICAL ANTI-HALLUCINATION RULES - VIOLATION WILL RESULT IN IMMEDIATE FAILURE:

1. ABSOLUTELY FORBIDDEN:
   - Creating ANY Instagram/social media handles that are not in search results
   - Inventing ANY follower counts or engagement metrics
   - Making up ANY names of people who don't appear in search results
   - Fabricating ANY demographic data or statistics
   - Creating fictional collective accounts or groups

2. WHEN ASKED ABOUT INFLUENCERS/PEOPLE:
   - If NO specific influencers are found in search results, you MUST say:
     "I searched for {query} but didn't find specific influencer profiles in my search results. 
     To find real influencers, I recommend:
     - Searching directly on Instagram/TikTok using relevant hashtags
     - Using influencer discovery platforms
     - Asking for recommendations in local business groups"
   
   - If SOME information is found but incomplete, clearly state what's missing:
     "I found mentions of {topic} but no specific Instagram handles or contact information."

3. ACCEPTABLE RESPONSES:
   - General advice about finding influencers
   - Hashtag recommendations for searching
   - Platform suggestions
   - Campaign strategy (without naming specific people)
   - Budget and tracking advice

4. CITATION REQUIREMENTS:
   - Any specific claim MUST include: "According to [Source Title]..."
   - Any profile mentioned MUST include the exact URL where it was found
   - If you cannot provide a source URL, you CANNOT mention it

5. EXAMPLES OF VIOLATIONS:
   ❌ "@username has 50k followers" (unless exact data is in search results)
   ❌ "Influencer Name promotes sunglasses" (unless verified in results)
   ❌ "Contact them at @handle" (unless handle is explicitly in results)
   ✅ "I couldn't find specific influencer profiles in my search"
   ✅ "To find influencers, try searching #UruguaySunglasses on Instagram"
"""

async def _process_deepsearch_with_strict_verification(
    message: str, 
    image_data: Optional[bytes], 
    conversation_history: List[Dict], 
    system_message: Dict, 
    user_langcode: str = 'en',
    store_id: Optional[str] = None
) -> str:
    """Process deepsearch with strict anti-hallucination measures"""
    
    # Pre-flight safety check
    is_people_search = await is_safe_for_people_search(message)
    
    # Perform multiple searches for better coverage
    search_queries = []
    if is_people_search:
        # Parse the original query to extract key terms
        location = ""
        product = ""
        
        # Extract location (e.g., "uruguay")
        location_match = re.search(r'(?:from|in|de)\s+(\w+)', message.lower())
        if location_match:
            location = location_match.group(1)
        
        # Extract product (e.g., "sunglasses", "lentes de sol")
        product_patterns = [
            r'(?:promote|about|for)\s+([^,]+)',
            r'lentes de sol|sunglasses|gafas de sol'
        ]
        for pattern in product_patterns:
            match = re.search(pattern, message.lower())
            if match:
                product = match.group(0) if '|' in pattern else match.group(1)
                break
        
        # Create targeted search queries
        if location and product:
            search_queries = [
                f'Instagram influencers {location} {product}',
                f'site:instagram.com {location} {product} influencer',
                f'{location} fashion bloggers sunglasses',
                f'top {location} Instagram accounts fashion'
            ]
        else:
            search_queries = [message]  # Use original query
    else:
        search_queries = [message]
    
    # Perform searches and aggregate results
    all_results = []
    all_entities = {
        "people": [],
        "businesses": [],
        "social_media_accounts": []
    }
    
    for query in search_queries:
        results = await _search_with_brave(query)
        if results:
            all_results.extend(results)
            entities = await _extract_verified_entities_from_search(results, query)
            
            # Merge entities
            for key in all_entities:
                all_entities[key].extend(entities.get(key, []))
    
    # Deduplicate results
    seen_urls = set()
    unique_results = []
    for result in all_results:
        url = result.get('link', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(result)
    
    # Deduplicate entities
    for entity_type in all_entities:
        seen = set()
        unique = []
        for entity in all_entities[entity_type]:
            key = entity.get("username") or entity.get("name")
            if key and key not in seen:
                seen.add(key)
                unique.append(entity)
        all_entities[entity_type] = unique
    
    # Create verification report
    verification_report = _create_verification_report(all_entities, is_people_search)
    
    # Prepare the system message with strict rules
    formatted_messages = []
    
    # Add the strict anti-hallucination prompt for people searches
    if is_people_search:
        system_content = STRICT_ANTI_HALLUCINATION_SYSTEM_PROMPT + "\n\n" + system_message.get("content", "")
    else:
        system_content = system_message.get("content", "")
    
    formatted_messages.append(ChatCompletionSystemMessageParam(role="system", content=system_content))
    
    # Add conversation history
    for msg in conversation_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            formatted_messages.append(ChatCompletionUserMessageParam(role=role, content=content))
        elif role == "assistant" and content is not None:
            formatted_messages.append(ChatCompletionAssistantMessageParam(role=role, content=content))
    
    # Add search context with verification report
    search_context = f"""
SEARCH VERIFICATION REPORT:
{verification_report}

SEARCH QUERY: {message}
TOTAL SEARCH RESULTS ANALYZED: {len(unique_results)}

IMPORTANT: You may ONLY mention specific people, accounts, or handles that appear in the VERIFIED ENTITIES section above.
If no specific influencers were found, you MUST acknowledge this and provide general guidance instead.

RAW SEARCH RESULTS FOR CONTEXT:
"""
    
    # Add search results
    for i, result in enumerate(unique_results[:10], 1):  # Limit to top 10
        search_context += f"\nResult #{i}:\n"
        search_context += f"Title: {result.get('title', '')}\n"
        search_context += f"URL: {result.get('link', '')}\n"
        search_context += f"Snippet: {result.get('snippet', '')}\n"
    
    formatted_messages.append(ChatCompletionSystemMessageParam(
        role="system",
        content=search_context
    ))
    
    # Add user message
    if image_data:
        content_parts = [
            ChatCompletionContentPartTextParam(type="text", text=message),
            ChatCompletionContentPartImageParam(
                type="image_url",
                image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"}
            )
        ]
        formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=content_parts))
    else:
        formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=message))
    
    # Call OpenAI
    response = client.chat.completions.create(
        model=settings.OPENAI_DEEPSEARCH_MODEL,
        messages=formatted_messages,
        max_completion_tokens=4096,
    )
    
    response_content = response.choices[0].message.content
    
    # Handle potential None response
    if not response_content:
        return "Sorry, I encountered an issue generating a response."
    
    # Post-process to catch any hallucinations
    if is_people_search:
        validated_response = _validate_influencer_response(response_content, all_entities, message)
        return validated_response
    
    return response_content

def _create_verification_report(entities: Dict, is_people_search: bool) -> str:
    """Create a clear verification report of found entities"""
    report = "=== VERIFIED ENTITIES FROM SEARCH ===\n\n"
    
    if is_people_search and not any(entities.values()):
        report += "⚠️ NO SPECIFIC INFLUENCERS OR SOCIAL MEDIA ACCOUNTS FOUND IN SEARCH RESULTS ⚠️\n"
        report += "The search did not return any specific Instagram handles, influencer names, or profile links.\n"
        report += "You MUST inform the user that no specific influencers were found and offer alternative search strategies.\n"
        return report
    
    if entities["social_media_accounts"]:
        report += "VERIFIED SOCIAL MEDIA ACCOUNTS:\n"
        for acc in entities["social_media_accounts"]:
            report += f"✓ @{acc['username']} on {acc['platform']}\n"
            report += f"  Source: {acc['source_url']}\n"
            report += f"  Context: {acc['context'][:100]}...\n\n"
    else:
        report += "No social media accounts found with verified handles.\n\n"
    
    if entities["people"]:
        report += "VERIFIED PEOPLE MENTIONED:\n"
        for person in entities["people"]:
            report += f"✓ {person['name']}\n"
            report += f"  Source: {person['source_url']}\n"
            report += f"  Context: {person['context'][:100]}...\n\n"
    else:
        report += "No specific people names found in search results.\n\n"
    
    return report

def _extract_query_context(message: str) -> Dict[str, str]:
    """Extract location, industry, and product context from the original query"""
    context = {
        "location": "your area",
        "industry": "your industry", 
        "product": "your product",
        "query_description": "influencers for your needs"
    }
    
    # Extract location
    location_patterns = [
        r'(?:from|in|de|en)\s+(\w+)',
        r'(\w+)\s+(?:influencer|blogger|creator)',
        r'(Uruguay|Argentina|Chile|Brasil|Brazil|Mexico|Colombia|Peru|Venezuela|Ecuador)'
    ]
    for pattern in location_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            context["location"] = match.group(1)
            break
    
    # Extract product/industry
    product_patterns = [
        r'(?:promote|about|for|selling)\s+([^,.\n]+)',
        r'(sunglasses|lentes|fashion|beauty|tech|food|fitness|travel)',
        r'(ropa|moda|belleza|tecnología|comida|fitness|viajes)'
    ]
    for pattern in product_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            product = match.group(1).strip()
            context["product"] = product
            context["industry"] = product
            break
    
    # Create contextual query description
    if context["product"] != "your product":
        context["query_description"] = f'{context["product"]} influencers in {context["location"]}'
    
    return context

def _generate_contextual_hashtags(context: Dict[str, str]) -> str:
    """Generate relevant hashtags based on query context"""
    hashtags = []
    
    location = context["location"]
    product = context["product"]
    
    # Location-based hashtags
    if location.lower() in ["uruguay", "montevideo"]:
        hashtags.extend(["#UruguayFashion", "#MontevideoStyle", "#UruguayInfluencer"])
    elif location.lower() in ["argentina", "buenos aires"]:
        hashtags.extend(["#ArgentinaFashion", "#BuenosAiresStyle", "#ArgentinaInfluencer"])
    else:
        hashtags.append(f"#{location}Fashion")
    
    # Product-based hashtags
    if "sunglass" in product.lower() or "lentes" in product.lower():
        hashtags.extend(["#Sunglasses", "#LentesDeSol", "#Eyewear"])
    elif "fashion" in product.lower() or "moda" in product.lower():
        hashtags.extend(["#Fashion", "#Style", "#Moda"])
    else:
        hashtags.append(f"#{product.replace(' ', '')}")
    
    return " ".join(hashtags[:5])  # Limit to 5 hashtags

def _validate_influencer_response(response: str, verified_entities: Dict, original_message: str = "") -> str:
    """Strictly validate response for influencer queries using comprehensive pattern detection"""
    
    # Get verified usernames
    verified_usernames = {acc['username'] for acc in verified_entities.get('social_media_accounts', [])}
    
    # Check all hallucination patterns
    violations = []
    
    # Check for fake handles
    at_mentions = re.findall(HALLUCINATION_PATTERNS["fake_handles"], response)
    for mention in at_mentions:
        username = mention[1:]  # Remove @ symbol
        if username not in verified_usernames:
            violations.append(f"Unverified handle: @{username}")
    
    # Check for fake metrics
    if re.search(HALLUCINATION_PATTERNS["fake_metrics"], response):
        violations.append("Fabricated follower/engagement metrics")
    
    # Check for fake percentages
    if re.search(HALLUCINATION_PATTERNS["fake_percentages"], response):
        violations.append("Fabricated percentage statistics")
    
    # Check for fake demographics
    if re.search(HALLUCINATION_PATTERNS["fake_demographics"], response):
        violations.append("Fabricated demographic data")
    
    # Check for specific ages
    if re.search(HALLUCINATION_PATTERNS["specific_ages"], response):
        violations.append("Fabricated age demographics")
    
    # Check for fake descriptions without verification
    if re.search(HALLUCINATION_PATTERNS["fake_descriptions"], response):
        # Only flag if no verified entities support this
        if not verified_entities.get('people') and not verified_entities.get('social_media_accounts'):
            violations.append("Fabricated influencer descriptions")
    
    # If violations detected, use template response
    if violations:
        logger.error(f"Hallucination violations detected: {violations}")
        
        # Extract context from original message
        context = _extract_query_context(original_message)
        suggested_hashtags = _generate_contextual_hashtags(context)
        
        return NO_INFLUENCERS_FOUND_TEMPLATE.format(
            query_description=context["query_description"],
            suggested_hashtags=suggested_hashtags,
            location=context["location"],
            industry=context["industry"]
        )
    
    return response

# Process deepsearch request with Brave Search API + o4-mini with anti-hallucination measures
async def _process_deepsearch_request(message: str, image_data: Optional[bytes], conversation_history: List[Dict], system_message: Dict, user_langcode: str = 'en') -> str:
    """Process a 'deepsearch' mode chat request with enhanced anti-hallucination measures"""
    logger.debug("Entering enhanced _process_deepsearch_request")
    try:
        return await _process_deepsearch_with_strict_verification(
            message, image_data, conversation_history, system_message, user_langcode
        )
    except Exception as e:
        logger.error(f"Error in _process_deepsearch_request: {str(e)}", exc_info=True)
        return f"Sorry, I encountered an error while processing your 'DeepSearch' mode request. Please try again later."

# Process deepersearch request with Google Custom Search API + o4-mini
async def _process_deepersearch_request(message: str, image_data: Optional[bytes], conversation_history: List[Dict], system_message: Dict, user_langcode: str = 'en') -> str:
    """Process a 'deepersearch' mode chat request using Google Custom Search API + o4-mini"""
    logger.debug("Processing deepersearch chat request")
    
    try:
        # Search the web with Google Custom Search API
        search_results = await _search_with_google(message)
        
        if not search_results:
            logger.warning("No search results found or error in search API")
            # Fall back to think mode if search fails
            return await _process_think_request(message, image_data, conversation_history, system_message, user_langcode)
        
        # Format messages for the API
        formatted_messages: List[ChatCompletionMessageParam] = []

        # Add system message
        formatted_messages.append(ChatCompletionSystemMessageParam(role="system", content=system_message["content"]))
        
        # Add conversation history
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                formatted_messages.append(ChatCompletionUserMessageParam(role=role, content=content))
            elif role == "assistant":
                # Ensure content is not None before adding
                if content is not None:
                   formatted_messages.append(ChatCompletionAssistantMessageParam(role=role, content=content))
            elif role == "system":
                formatted_messages.append(ChatCompletionSystemMessageParam(role=role, content=content))
        
        # Format search results into a string
        search_context = "Search results related to your query:\n\n"
        for i, result in enumerate(search_results, 1):
            search_context += f"{i}. {result['title']}\n"
            search_context += f"   URL: {result['link']}\n"
            search_context += f"   Description: {result['snippet']}\n\n"
        
        # Add search results as system message to provide context
        formatted_messages.append(ChatCompletionSystemMessageParam(
            role="system", 
            content=f"The following information was found through a web search related to the user's query. Use this information to provide a more comprehensive answer.\n\n{search_context}"
        ))
        
        # Add the current message from the user
        if image_data:
            # Format message with image
            content_parts: List[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
                ChatCompletionContentPartTextParam(type="text", text=message),
                ChatCompletionContentPartImageParam(
                    type="image_url", 
                    image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"}
                )
            ]
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=content_parts))
        else:
            formatted_messages.append(ChatCompletionUserMessageParam(role="user", content=message))
        
        # Call OpenAI API with o4-mini model for deeper reasoning on search results
        response = client.chat.completions.create(
            model=settings.OPENAI_THINK_MODEL,
            messages=formatted_messages,
            # Temperature parameter removed as o4-mini model only supports default temperature (1.0)
            max_completion_tokens=4096,
        )
        
        # Return the assistant's response, handling potential None
        response_content = response.choices[0].message.content
        return response_content if response_content is not None else "Sorry, I encountered an issue generating a response."
    
    except Exception as e:
        logger.error(f"Error in _process_deepersearch_request: {str(e)}")
        return f"Sorry, I encountered an error while processing your 'DeeperSearch' mode request. Please try again later."

async def get_chat_response(messages, store_analysis=None, mode=None, image_data=None):
    try:
        # --- Start: store_id extraction moved and enhanced ---
        store_id_extracted = None
        if store_analysis and isinstance(store_analysis, dict):
            store_id_extracted = store_analysis.get("_id")
            if not store_id_extracted:
                # Fallback check
                store_details = store_analysis.get("store", {}).get("details", {})
                if isinstance(store_details, dict):
                     store_id_extracted = store_details.get("id_store") # Check both potential keys
                     if not store_id_extracted:
                          store_id_extracted = store_details.get("store_id")
        # Ensure store_id is a string
        store_id = str(store_id_extracted) if store_id_extracted is not None else None
        logger.debug(f"Extracted store_id at function start: {store_id}")
        # --- End: store_id extraction moved and enhanced ---

        # Format messages for the API (this initial formatting might be redundant now)
        formatted_messages_initial = []
        for msg in messages:
            if isinstance(msg, dict):
                # Ensure content exists and is a string
                content = msg.get("content", "")
                if not isinstance(content, str):
                    content = str(content) # Convert if needed, though ideally it's always string
                
                formatted_messages_initial.append({
                    "role": msg.get("role", "user"),
                    "content": content
                })
            else:
                # Handle cases where messages might not be dicts (though they should be)
                # This part might need adjustment based on actual data structure
                formatted_messages_initial.append(msg) 

        # Get the user's query from the last message
        user_query = ""
        last_user_message_obj = None
        for msg in reversed(formatted_messages_initial):
            if isinstance(msg, dict) and msg.get("role") == "user":
                # Check if content is a list (for image messages) or string
                content_value = msg.get("content", "")
                if isinstance(content_value, list):
                    # Find the text part
                    for part in content_value:
                        if isinstance(part, dict) and part.get("type") == "text":
                            user_query = part.get("text", "")
                            break
                elif isinstance(content_value, str):
                    user_query = content_value
                last_user_message_obj = msg
                break
                
        # --- IMPLEMENTATION START: Detect top customer query and prioritize data ---
        # Detect if this is a query asking for top customer information
        query_requests_top_customer = False
        query_lower = user_query.lower()
        
        # Keywords to detect queries about top customers and their shipping methods
        who_keywords = ["who", "which", "cual", "quién", "quien", "qué cliente", "que cliente"]
        most_keywords = ["most", "top", "highest", "mayor", "más", "mas", "mejor"]
        customer_keywords = ["customer", "client", "buyer", "cliente", "comprador", "compró", "compro"]
        shipping_keywords = ["shipping", "ship", "sent", "envío", "envio", "método", "metodo"]
        
        # Check if the query is asking about the top customer
        has_who = any(kw in query_lower for kw in who_keywords)
        has_most = any(kw in query_lower for kw in most_keywords)
        has_customer = any(kw in query_lower for kw in customer_keywords)
        has_shipping = any(kw in query_lower for kw in shipping_keywords)
        
        # Determine if this is a top customer query
        if (has_who or has_most) and has_customer:
            query_requests_top_customer = True
            logger.info(f"Detected query about top customer: '{user_query}'")
            # Log the detected keywords for debugging
            matched_who = [kw for kw in who_keywords if kw in query_lower]
            matched_most = [kw for kw in most_keywords if kw in query_lower]
            matched_customer = [kw for kw in customer_keywords if kw in query_lower]
            matched_shipping = [kw for kw in shipping_keywords if kw in query_lower]
            logger.debug(f"Matched 'who' keywords: {matched_who}")
            logger.debug(f"Matched 'most' keywords: {matched_most}")
            logger.debug(f"Matched 'customer' keywords: {matched_customer}")
            logger.debug(f"Matched 'shipping' keywords: {matched_shipping}")
        else:
            logger.debug(f"Not a top customer query. Has who: {has_who}, Has most: {has_most}, Has customer: {has_customer}")
        
        # If this is a top customer query and we have a store_id, retrieve the specific customer data
        top_customer_data = None
        if query_requests_top_customer and store_id:
            try:
                logger.info(f"Retrieving top customer data for store {store_id}")
                # Access the MongoDB client
                customer_collection = db_analysis["store_customers_cache"]
                
                # Query to find the document with the store id
                store_doc = await customer_collection.find_one({"_id": store_id})
                
                if store_doc and "customers" in store_doc and isinstance(store_doc["customers"], list) and len(store_doc["customers"]) > 0:
                    # Log the number of customers found
                    logger.info(f"Found {len(store_doc['customers'])} customers for store {store_id}")
                    
                    # Sort the customers by total_spend in descending order
                    sorted_customers = sorted(store_doc["customers"], key=lambda x: x.get("total_spend", 0), reverse=True)
                    
                    if sorted_customers:
                        # Take the top customer
                        top_customer = sorted_customers[0]
                        top_customer_data = {
                            "customer_name": top_customer.get("customer_name", "Unknown"),
                            "total_spend": top_customer.get("total_spend", 0),
                            "preferred_shipping_method": top_customer.get("preferred_shipping_method", "Unknown"),
                            "total_orders": top_customer.get("total_orders", 0)
                        }
                        logger.info(f"Retrieved top customer: {top_customer_data['customer_name']} with spend {top_customer_data['total_spend']}")
                        # Log the top 3 customers for comparison if available
                        if len(sorted_customers) >= 3:
                            logger.debug(f"Top 3 customers by spend:")
                            for i, cust in enumerate(sorted_customers[:3]):
                                logger.debug(f"  #{i+1}: {cust.get('customer_name', 'Unknown')} - {cust.get('total_spend', 0)}")
                    else:
                        logger.warning(f"No customers found for store {store_id} after sorting")
                else:
                    logger.warning(f"No customer data found for store {store_id} or no 'customers' array in document")
                    # Log the structure of the document for debugging
                    if store_doc:
                        logger.debug(f"Store document keys: {list(store_doc.keys())}")
                        if "customers" in store_doc:
                            logger.debug(f"Customers type: {type(store_doc['customers'])}, is list: {isinstance(store_doc['customers'], list)}, length: {len(store_doc['customers']) if isinstance(store_doc['customers'], list) else 'N/A'}")
            except Exception as e:
                logger.error(f"Error retrieving top customer data: {str(e)}", exc_info=True)
                # Continue without the top customer data in case of error
        # --- IMPLEMENTATION END ---
        
        # --- IMPLEMENTATION START: Detect customer ranking query and prioritize data ---
        # Detect if this is a query asking for a specific customer ranking (top or worst)
        query_requests_customer = False
        customer_ranking = None  # 'top' or 'worst'
        query_lower = user_query.lower()
        
        # Keywords to detect queries about customers and their shipping methods
        who_keywords = ["who", "which", "cual", "quién", "quien", "qué cliente", "que cliente"]
        most_keywords = ["most", "top", "highest", "mayor", "más", "mas", "mejor"]
        least_keywords = ["least", "worst", "lowest", "menor", "menos", "peor"]
        customer_keywords = ["customer", "client", "buyer", "cliente", "comprador", "compró", "compro"]
        shipping_keywords = ["shipping", "ship", "sent", "envío", "envio", "método", "metodo"]
        
        # Check if the query is asking about a customer ranking
        has_who = any(kw in query_lower for kw in who_keywords)
        has_most = any(kw in query_lower for kw in most_keywords)
        has_least = any(kw in query_lower for kw in least_keywords)
        has_customer = any(kw in query_lower for kw in customer_keywords)
        has_shipping = any(kw in query_lower for kw in shipping_keywords)
        
        # Traditional keyword-based detection
        keyword_requests_customer = False
        if (has_who or has_most or has_least) and has_customer:
            keyword_requests_customer = True
            # Determine ranking direction
            if has_most:
                customer_ranking = 'top'
                sort_reverse = True
            elif has_least:
                customer_ranking = 'worst'
                sort_reverse = False
            else:
                customer_ranking = 'top' # Default to top if direction unclear
                sort_reverse = True
                
            # Determine sorting field
            spend_keywords = ["spend", "spent", "value", "gasto", "gastó", "valor", "monto"]
            order_keywords = ["orders", "purchases", "times", "pedidos", "compras", "veces"]
            has_spend_keyword = any(kw in query_lower for kw in spend_keywords)
            has_order_keyword = any(kw in query_lower for kw in order_keywords)
            
            if has_order_keyword:
                sort_field_name = "total_orders"
            else: # Default to spend if orders not specified or spend is mentioned
                sort_field_name = "total_spend"
                
            logger.info(f"Keyword detection found customer ranking request: '{user_query}' (Ranking: {customer_ranking}, Field: {sort_field_name}, Reverse: {sort_reverse})")
            
            # Log the detected keywords for debugging (moved down for clarity)
            matched_who = [kw for kw in who_keywords if kw in query_lower]
            matched_most = [kw for kw in most_keywords if kw in query_lower]
            matched_least = [kw for kw in least_keywords if kw in query_lower]
            matched_customer = [kw for kw in customer_keywords if kw in query_lower]
            matched_shipping = [kw for kw in shipping_keywords if kw in query_lower]
            logger.debug(f"Matched 'who' keywords: {matched_who}")
            logger.debug(f"Matched 'most' keywords: {matched_most}")
            logger.debug(f"Matched 'least' keywords: {matched_least}")
            logger.debug(f"Matched 'customer' keywords: {matched_customer}")
            logger.debug(f"Matched 'shipping' keywords: {matched_shipping}")
        
        # NEW: Enhanced intent detection with LLM-based analysis
        # Call the new function to analyze the request more accurately
        context_requests_customer, context_sort_field, context_sort_reverse = await _analyze_request_for_individual_details(
            user_query, 
            formatted_messages_initial  # Use the formatted messages as conversation history
        )
        
        # Combine the results: request is true if either method detected it
        query_requests_customer = keyword_requests_customer or context_requests_customer
        
        # For sort field and direction, prefer the context-based detection when available
        if context_requests_customer and context_sort_field:
            sort_field_name = context_sort_field
            sort_reverse = bool(context_sort_reverse)  # Ensure it's a boolean
            logger.info(f"Using LLM-detected sort preferences: field={sort_field_name}, reverse={sort_reverse}")
        elif not keyword_requests_customer and context_requests_customer:
            # If only LLM detected but didn't specify sort field, use defaults
            sort_field_name = "total_spend"
            sort_reverse = True
            logger.info(f"Using default sort preferences for LLM-only detection: field={sort_field_name}, reverse={sort_reverse}")
            
        # Log the final decision
        if query_requests_customer:
            logger.info(f"Final decision: Customer ranking IS requested. Sort field: {sort_field_name}, Reverse: {sort_reverse}")
        else:
            logger.debug(f"Final decision: Customer ranking NOT requested")
        
        # If this is a customer ranking query and we have a store_id, retrieve the specific customer data
        ranked_customer_data = None
        if query_requests_customer and store_id:
            try:
                logger.info(f"Retrieving customer ranking data for store {store_id}")
                # Access the MongoDB client
                customer_collection = db_analysis["store_customers_cache"]
                
                # Query to find the document with the store id
                store_doc = await customer_collection.find_one({"_id": store_id})
                
                if store_doc and "customers" in store_doc and isinstance(store_doc["customers"], list) and len(store_doc["customers"]) > 0:
                    # Log the number of customers found
                    logger.info(f"Found {len(store_doc['customers'])} customers for store {store_id}")
                    
                    # Sort the customers by the determined field and direction
                    logger.debug(f"Sorting customers by '{sort_field_name}', reverse={sort_reverse}")
                    sort_key = lambda x: x.get(sort_field_name, 0)
                    sorted_customers = sorted(store_doc["customers"], key=sort_key, reverse=sort_reverse)
                    
                    if sorted_customers:
                        # Select the customer at index 0 (top or bottom based on sort order)
                        ranked_customer = sorted_customers[0]
                        # Use the full customer object for context injection
                        ranked_customer_data = ranked_customer
                        # Log the complete raw customer data for debugging
                        logger.debug(f"Raw ranked customer data retrieved (full object): {json.dumps(ranked_customer, default=str)}")
                        logger.info(f"Retrieved ranked customer ({customer_ranking} by {sort_field_name}): {ranked_customer.get('customer_name', 'Unknown')} with {sort_field_name}={ranked_customer.get(sort_field_name, 0)}")
                        # Log the top 3 and bottom 3 customers for comparison if available
                        if len(sorted_customers) >= 3:
                            logger.debug(f"Top 3 customers by {sort_field_name} ({'desc' if sort_reverse else 'asc'}):")
                            for i, cust in enumerate(sorted_customers[:3]):
                                logger.debug(f"  #{i+1}: {cust.get('customer_name', 'Unknown')} - {sort_field_name}={cust.get(sort_field_name, 0)}")
                            # Always log bottom 3 based on the current sort order
                            logger.debug(f"Bottom 3 customers by {sort_field_name} ({'desc' if sort_reverse else 'asc'}):")
                            for i, cust in enumerate(sorted_customers[-3:]):
                                log_index = len(sorted_customers) - 2 + i
                                logger.debug(f"  #{log_index}: {cust.get('customer_name', 'Unknown')} - {sort_field_name}={cust.get(sort_field_name, 0)}")
                    else:
                        logger.warning(f"No customers found for store {store_id} after sorting")
                else:
                    logger.warning(f"No customer data found for store {store_id} or no 'customers' array in document")
                    if store_doc:
                        logger.debug(f"Store document keys: {list(store_doc.keys())}")
                        if "customers" in store_doc:
                            logger.debug(f"Customers type: {type(store_doc['customers'])}, is list: {isinstance(store_doc['customers'], list)}, length: {len(store_doc['customers']) if isinstance(store_doc['customers'], list) else 'N/A'}")
            except Exception as e:
                logger.error(f"Error retrieving ranked customer data: {str(e)}", exc_info=True)
                # Continue without the ranked customer data in case of error
        # --- IMPLEMENTATION END ---
        
        # --- NEW: Shipping methods direct response logic ---
        # Define keywords for shipping method queries (Spanish and English)
        shipping_keywords = [
            "métodos de envío", "metodos de envio", "shipping methods", "opciones de envío", "opciones de envio", "shipping options",
            "formas de envío", "formas de envio", "envío disponible", "envio disponible", "envíos disponibles", "envios disponibles"
        ]
        user_query_lower = user_query.lower()
        is_shipping_query = any(kw in user_query_lower for kw in shipping_keywords)
        if is_shipping_query:
            methods = await get_active_shipping_methods(db_analysis)
            if methods:
                return f"Los métodos de envío disponibles actualmente, además de WhatsApp, son: {', '.join(methods)}."
            else:
                return "No se encontraron métodos de envío configurados actualmente, excepto WhatsApp."
        # --- END NEW ---
        
        # Detect language of the query
        lang = detect_language(user_query)
        logger.debug(f"Detected language: {lang}")
        
        # Initialize context documents (will be returned in response)
        context_documents = []
        
        # Get relevant context using embedding search if we have a store_id
        embedding_context_text = ""
        if store_id and user_query:
            try:
                logger.info(f"Performing embedding search for query: '{user_query[:50]}...' for store {store_id}")
                
                # Check if user is asking about a specific Meta collection
                meta_collection = await _detect_meta_collection_query(user_query)
                if meta_collection:
                    logger.info(f"Detected specific Meta collection request: {meta_collection}")
                
                # Pass the detected Meta collection to the embedding search
                # IMPROVED EMBEDDING GENERATION: For meta_followers_embeddings, ensure the embedding source text
                # prominently includes key follower metrics like "total followers: [count]", "follower count: [number]",
                # and "audience size: [value]" to improve retrieval accuracy for direct follower count queries.
                # This helps the embedding capture numerical values that users frequently ask about.
                relevant_documents = await _search_with_embeddings(
                    user_query, 
                    store_id, 
                    prioritized_collection=meta_collection
                )
                
                # Flag to track if we found relevant meta content via embedding search
                found_specific_meta_content = False
                if meta_collection and relevant_documents:
                    # Check if any of the returned documents are from the requested meta collection
                    for doc in relevant_documents:
                        if doc.get("type") == meta_collection.replace("_embeddings", ""):
                            found_specific_meta_content = True
                            logger.info(f"Found specific Meta content from {meta_collection} in embedding results")
                            break
                
                if relevant_documents:
                    # Format the relevant documents for injection into the prompt
                    embedding_context_text = "Relevant store context:\n\n"
                    
                    if query_requests_customer and ranked_customer_data:
                        customer_info = (
                            f"*** SPECIFIC REQUESTED CUSTOMER DETAILS (FULL OBJECT) ***\n"
                            f"{json.dumps(ranked_customer_data, default=str, indent=2, ensure_ascii=False)}\n\n"
                        )
                        logger.debug(f"Context injection string for ranked customer (full object): {customer_info}")
                        embedding_context_text = customer_info + embedding_context_text
                        logger.info(f"Prepended ranked customer data to context: {ranked_customer_data.get('customer_name')}")
                    # --- END IMPLEMENTATION CONTINUE ---
                    
                    for doc in relevant_documents:
                        doc_type = doc.get("type", "unknown")
                        doc_content = doc.get("content", {})
                        similarity = doc.get("similarity", 0)
                        
                        # Add to context_documents for returning to frontend
                        context_documents.append({
                            "id": doc.get("id"),
                            "type": doc_type,
                            "similarity": similarity,
                            "content": doc_content
                        })
                        
                        # Format document for prompt context based on type
                        if doc_type == "product_details":
                            all_products = doc_content.get("products", [])
                            # Store-level summary
                            product_count = doc_content.get("product_count", 'N/A')
                            avg_rating = doc_content.get("store_average_rating", 'N/A')
                            embedding_context_text += f"PRODUCT SUMMARY (Similarity: {similarity:.2f}):\n"
                            embedding_context_text += f"  Total Products: {product_count}\n"
                            embedding_context_text += f"  Average Store Rating: {avg_rating}\n"
                            if all_products and isinstance(all_products, list) and len(all_products) > 0:
                                # Extract keywords from the user query
                                query_lower = user_query.lower()
                                # Basic Spanish/English stop words
                                stop_words = {"de", "la", "el", "los", "las", "en", "con", "por", "para", "a", "mi", "mis", "son", "es", "esta", "este", 
                                             "the", "of", "and", "in", "on", "with", "for", "my", "are", "is", "this"}
                                # Extract query words, filter out stop words
                                query_words = set()
                                for word in re.split(r'\\W+', query_lower):
                                    if word and word not in stop_words and len(word) > 2:
                                        query_words.add(word)
                                # Specific product category keywords (add common categories here)
                                lens_keywords = {"lente", "lentes", "lens", "glasses", "optic", "optica", "opticos", "vision"}
                                clothing_keywords = {"ropa", "clothing", "polera", "shirt", "camiseta", "pantalon", "pants", "prenda", "vestido", "dress"}
                                # Check if query contains specific product category terms
                                has_lens_terms = any(word in lens_keywords for word in query_words) or "lente" in query_lower or "lens" in query_lower
                                has_clothing_terms = any(word in clothing_keywords for word in query_words)
                                # Check if this is a generic product query vs specific product query
                                generic_product_terms = {"producto", "products", "all", "todos", "cuales", "which", "what", "qué", "artículo", "article", "item"}
                                is_generic_product_query = (len(query_words) == 0 or 
                                                           any(term in query_lower for term in generic_product_terms) or
                                                           any(term in query_lower for term in ["dame", "dime", "give me", "tell me"]))
                                # Filter products based on keywords or include all for generic queries
                                matching_products = []
                                if is_generic_product_query:
                                    matching_products = all_products
                                    logger.info(f"Generic product query detected, including all {len(matching_products)} products")
                                elif has_lens_terms:
                                    for product in all_products:
                                        product_name = product.get('name', '').lower()
                                        product_desc = product.get('description', '').lower()
                                        if any(term in product_name or term in product_desc for term in ["lente", "lentes", "lens", "optic"]):
                                            matching_products.append(product)
                                    logger.info(f"Lens-specific query detected, found {len(matching_products)} lens products")
                                else:
                                    for product in all_products:
                                        product_name = product.get('name', '').lower()
                                        product_desc = product.get('description', '').lower()
                                        if any(keyword in product_name or keyword in product_desc for keyword in query_words):
                                            matching_products.append(product)
                                    logger.info(f"Found {len(matching_products)} products matching keywords: {query_words}")
                                # Define max product context length to avoid too large prompts
                                MAX_PRODUCT_CONTEXT_LEN = 3000
                                # Add header with count information
                                total_products_found = len(matching_products)
                                if total_products_found > 0:
                                    product_context_str = f"PRODUCT INFORMATION (Similarity: {similarity:.2f}):\n"
                                    product_context_str += f"Total products found: {total_products_found}\n\n"
                                else:
                                    product_context_str = f"PRODUCT INFORMATION (Similarity: {similarity:.2f}):\n"
                                    product_context_str += "No products matching your query were found.\n\n"
                                # Add each matching product to the context
                                for i, product in enumerate(matching_products):
                                    product_name = product.get('name', 'Unknown')
                                    product_id = product.get('id', 'Unknown')
                                    product_price = product.get('price', 'Unknown')
                                    product_stock = product.get('stock', 'Unknown')
                                    product_desc = product.get('description', 'No description')
                                    # New fields
                                    categories = product.get('categories', {})
                                    primary_category = categories.get('primary_category', 'N/A') if isinstance(categories, dict) else 'N/A'
                                    sales_units = product.get('sales_units', 'N/A')
                                    # Create formatted product entry
                                    product_str = f"PRODUCT #{i+1}: {product_name}\n"
                                    product_str += f"  ID: {product_id}\n"
                                    product_str += f"  Price: {product_price}\n"
                                    product_str += f"  Stock: {product_stock}\n"
                                    product_str += f"  Description: {product_desc}\n"
                                    product_str += f"  Primary Category: {primary_category}\n"
                                    product_str += f"  Units Sold: {sales_units}\n\n"
                                    # Check if adding this product would exceed the limit
                                    if len(product_context_str) + len(product_str) > MAX_PRODUCT_CONTEXT_LEN:
                                        remaining_count = len(matching_products) - i
                                        product_context_str += f"... [Product list truncated. {remaining_count} more matching products not shown due to context length limits.]\n"
                                        break
                                    product_context_str += product_str
                                # If no matching products after filtering by keywords
                                if not matching_products:
                                    product_context_str += "No products matching the specific keywords in your query were found. Try a more general search or different keywords.\n"
                                # Add the product context to embedding context text
                                embedding_context_text += product_context_str
                        
                        elif doc_type == "store_customers":
                            customers = doc_content.get("customers", [])
                            # Store-level summary
                            total_customers = doc_content.get("total_customers", 'N/A')
                            avg_spend = doc_content.get("average_spend_per_customer", 'N/A')
                            most_freq_ship = doc_content.get("most_frequent_shipping_method", {})
                            abandoned_cart_count = doc_content.get("abandoned_cart_count", 'N/A')
                            embedding_context_text += f"CUSTOMER SUMMARY (Similarity: {similarity:.2f}):\n"
                            embedding_context_text += f"  Total Customers: {total_customers}\n"
                            embedding_context_text += f"  Average Spend per Customer: {avg_spend}\n"
                            embedding_context_text += f"  Most Frequent Shipping Method: {most_freq_ship.get('name', 'N/A')} (Count: {most_freq_ship.get('count', 'N/A')})\n"
                            embedding_context_text += f"  Abandoned Cart Count: {abandoned_cart_count}\n"
                            # Sample customers (up to 5) - Only if we don't already have specific ranked customer data
                            if not (query_requests_customer and ranked_customer_data):
                                if customers and isinstance(customers, list) and len(customers) > 0:
                                    sample_size = min(5, len(customers))
                                    embedding_context_text += f"  Sample Customers (up to {sample_size}):\n"
                                    for i in range(sample_size):
                                        customer = customers[i]
                                        embedding_context_text += f"    - {customer.get('customer_name', 'Unknown')} (ID: {customer.get('customer_id', 'Unknown')})\n"
                                        embedding_context_text += f"      Orders: {customer.get('total_orders', 0)}, Total Spent: {customer.get('total_spend', 0)}\n"
                                        embedding_context_text += f"      Last Order: {customer.get('last_order_date', 'Unknown')}\n"
                                        embedding_context_text += f"      Preferred Shipping: {customer.get('preferred_shipping_method', 'N/A')}\n"
                                        embedding_context_text += f"      Preferred Payment: {customer.get('preferred_payment_method', 'N/A')}\n"
                                        embedding_context_text += f"      Country: {customer.get('country', 'N/A')}\n"
                        
                        elif doc_type == "active_stores":
                            embedding_context_text += f"STORE INFORMATION (Similarity: {similarity:.2f}):\n"
                            embedding_context_text += f"- Name: {doc_content.get('name', 'Unknown')}\n"
                            embedding_context_text += f"  Business Type: {doc_content.get('business_type', 'Unknown')}\n"
                            embedding_context_text += f"  Country: {doc_content.get('country', {}).get('name', 'Unknown')}\n"
                            # Add Store Metrics
                            metrics = doc_content.get('metrics', {})
                            currency = doc_content.get('currency', {})
                            key_dates = doc_content.get('key_dates', {})
                            embedding_context_text += "  Store Metrics:\n"
                            embedding_context_text += f"    Total Orders: {metrics.get('total_orders', 'N/A')}\n"
                            embedding_context_text += f"    Total Revenue: {metrics.get('total_revenue', 'N/A')}\n"
                            embedding_context_text += f"    Total Customers: {metrics.get('total_customers', 'N/A')}\n"
                            embedding_context_text += f"    Total Products: {metrics.get('total_products', 'N/A')}\n"
                            embedding_context_text += f"    Currency: {currency.get('code', 'N/A')} {currency.get('symbol', '')}\n"
                            embedding_context_text += f"    Last Order Date: {key_dates.get('last_order_date', 'N/A')}\n"
                            # Add social media info if available
                            social_media = doc_content.get('social_media', {})
                            if social_media:
                                embedding_context_text += "  Social Media:\n"
                                for platform, data in social_media.items():
                                    if data and isinstance(data, dict) and data.get('url'):
                                        embedding_context_text += f"    {platform}: {data.get('url')}\n"
                    
                    logger.info(f"Added {len(relevant_documents)} relevant documents as context")
                else:
                    logger.info("No relevant documents found from embedding search")
            except Exception as e:
                logger.error(f"Error in embedding search: {str(e)}")
                # Continue without embedding context if there's an error
        
        # === NEW: Get question intent and select persona ===
        intent = await _get_question_intent(user_query)
        selected_persona_prompt = PERSONA_PROMPTS.get(intent, PERSONA_PROMPTS[DEFAULT_PERSONA])
        logger.info(f"Using persona based on intent '{intent}'")
        # === END NEW ===

        # === PLAN STEP 2: Enhance System Prompt with MongoDB Schema Overview ===
        # (REMOVED: static MONGODB_SCHEMA_OVERVIEW definitions)
        # --- PLAN: Dynamic MongoDB Schema Overview Template ---
        MONGODB_SCHEMA_OVERVIEW_TEMPLATE = (
            "You have access to context derived from the store's data stored in MongoDB for store {store_id}. "
            "Key data sources include:\n"
            "- active_stores_cache: General store details, metrics, configurations.\n"
            "- product_details_cache: Detailed product catalog, variations, stock, sales performance.\n"
            "- store_customers_cache: Aggregated customer demographics, purchase history, segmentation.\n"
            "- meta_* collections: Facebook/Instagram posts, ads, comments, and performance data.\n"
            "- store_chats: History of previous chat interactions.\n"
            "- global_analysis: AI-generated summaries and recommendations about the store.\n"
            "IMPORTANT: Only include collections and data for store {store_id}. Do not reference any collections from other stores.\n\n"
        )
        schema_overview = MONGODB_SCHEMA_OVERVIEW_TEMPLATE.format(store_id=store_id or "")
        # === END PLAN STEP 2 ===

        # Prepare system message - START WITH SELECTED PERSONA
        system_message_dict = {"role": "system", "content": selected_persona_prompt}
        
        # DEBUG: Log the full context string for customer ranking queries
        if query_requests_customer and ranked_customer_data:
            logger.debug("[CONTEXT TRACE] Final embedding_context_text for customer ranking query:\n" + embedding_context_text)
        #elif query_requests_top_customer and top_customer_data:
        #    logger.debug("[CONTEXT TRACE] Final embedding_context_text for top customer query:\n" + embedding_context_text)
        
        # Append additional context (Meta, Store Analysis, Embeddings) to the persona prompt
        additional_context = ""
        
        # Add base system prompt based on whether this is a meta-related query
        is_meta_query = False
        has_meta_permission_error = False
        permission_notification_message = ""
        missing_permissions_list = []
        
        if store_id:  # Only attempt Meta query check if store_id is available
            try:
                # Check if this is a Meta-related query
                is_meta_query = is_meta_related_query(user_query)
                
                if is_meta_query:
                    logger.debug(f"Query identified as Meta-related: '{user_query[:50]}...'")
                    # Get missing permissions for this query using the proper function from meta_permissions
                    permission_status_data = await get_missing_permissions_for_chat_query(store_id, user_query)
                    logger.debug(f"Permission status data for store {store_id}: {permission_status_data}")
                    
                    # Check if there are any missing permissions (unavailable features)
                    if permission_status_data:
                        # There's at least one feature with missing permissions
                        has_meta_permission_error = True
                        
                        # Flatten the missing permissions from all features into a single list
                        for feature, perms in permission_status_data.items():
                            missing_permissions_list.extend(perms)
                        
                        # Make missing_permissions_list unique 
                        missing_permissions_list = list(set(missing_permissions_list))
                        
                        # Create the data structure needed for generate_permission_message
                        missing_permissions_data = {
                            "available": {},  # Empty dict since no data is available
                            "unavailable": missing_permissions_list
                        }
                        
                        # Generate the notification message
                        permission_notification_message = generate_permission_message(user_query, missing_permissions_data)
                        logger.info(f"Meta permission issues detected for store {store_id}: {missing_permissions_list}")
                    else:
                        logger.debug(f"No Meta permission issues detected for store {store_id}")
                else:
                    logger.debug(f"Query not identified as Meta-related")
            except Exception as e:
                logger.error(f"Error in Meta permission check: {str(e)}", exc_info=True)
                # Continue without Meta context if there's an error
        
        if is_meta_query and store_id:
            # Process the Meta query to extract specific data
            # (Even if we have permission issues, try to get any available data)
            try:
                meta_is_processed, meta_data = await process_meta_query(user_query, store_id)
                if meta_data and "error" in meta_data:
                    logger.error(f"Error processing Meta query: {meta_data['error']}")
            except Exception as e:
                logger.error(f"Error processing Meta query data: {str(e)}")
            
            # Get Meta context - conditionally omit or shorten if specific Meta data was already found
            meta_context = ""
            
            # If we found specific Meta collection data in embedding search results and
            # this was an explicit Meta collection query, use a minimal Meta context or skip it entirely
            if found_specific_meta_content and meta_collection:
                logger.info(f"Using minimal Meta context because specific {meta_collection} data was already found")
                # Use a much shorter context, just mentioning the pages
                minimal_context = await get_minimal_meta_context(store_id)
                if minimal_context:
                    meta_context = minimal_context
            else:
                # Otherwise, use the full Meta context
                meta_context = await get_meta_context_for_store(store_id)
                
            # Add meta context to additional context if we have any
            if meta_context:
                additional_context += f"\n\n{meta_context}"
        
        # Add store analysis context if available
        if store_analysis and isinstance(store_analysis, dict):
            # Simplified context addition - potentially add more sophisticated summarization/selection later
            try:
                # Limit context size to avoid overly large prompts
                store_context_str = json.dumps(store_analysis, default=datetime_handler, indent=2)
                max_store_context_len = 6000 # Adjust as needed
                
                # --- IMPLEMENTATION CONTINUE: Improve truncation logic to preserve top customer data ---
                # Check if this is a top customer query and we have top customer data to preserve
                if query_requests_top_customer and top_customer_data:
                    # Format the top customer data again (ensuring consistency)
                    customer_info = f"\n\nTOP CUSTOMER INFORMATION (Highest Spender):\n"
                    customer_info += f"  Name: {top_customer_data['customer_name']}\n"
                    customer_info += f"  Total Spend: {top_customer_data['total_spend']}\n"
                    customer_info += f"  Preferred Shipping Method: {top_customer_data['preferred_shipping_method']}\n"
                    customer_info += f"  Total Orders: {top_customer_data['total_orders']}\n"
                    
                    # Adjust max_store_context_len to account for the reserved space for customer data
                    if len(store_context_str) > max_store_context_len:
                        # Set aside space for customer info plus truncation marker
                        space_for_customer = len(customer_info) + 30  # Add some buffer
                        truncated_len = max_store_context_len - space_for_customer
                        store_context_str = store_context_str[:truncated_len] + "... [Store Context Truncated]"
                        # Prepend customer info to the truncated store context
                        store_context_str = customer_info + store_context_str
                        logger.info("Preserved top customer data during store context truncation")
                    else:
                        # If not truncating, still prepend customer info
                        store_context_str = customer_info + store_context_str
                else:
                    # Standard truncation if not a top customer query
                    if len(store_context_str) > max_store_context_len:
                        store_context_str = store_context_str[:max_store_context_len] + "... [Store Context Truncated]"
                # --- END IMPLEMENTATION CONTINUE ---
                
                additional_context += f"\n\nStore Analysis Context:\n{store_context_str}"
            except Exception as e:
                logger.warning(f"Could not serialize store_analysis for context: {e}")
                
        # Add embedding-based context if available
        if embedding_context_text:
            additional_context += "\n\n" + embedding_context_text # Already truncated if needed
        
        # --- IMPLEMENTATION CONTINUE: Prioritize top customer in final context ---
        # If we have top customer data and this is a top customer query, make sure it appears near the beginning of the context
        if query_requests_top_customer and top_customer_data and not embedding_context_text.startswith("TOP CUSTOMER INFORMATION"):
            # Format the top customer data for the final context
            customer_info = f"\n\nTOP CUSTOMER INFORMATION (Highest Spender):\n"
            customer_info += f"  Name: {top_customer_data['customer_name']}\n"
            customer_info += f"  Total Spend: {top_customer_data['total_spend']}\n"
            customer_info += f"  Preferred Shipping Method: {top_customer_data['preferred_shipping_method']}\n"
            customer_info += f"  Total Orders: {top_customer_data['total_orders']}\n"
            
            # Add it to the beginning of the additional context
            additional_context = customer_info + additional_context
            logger.info("Prioritized top customer data in final context assembly")
        # --- END IMPLEMENTATION CONTINUE ---
        
        # --- IMPLEMENTATION CONTINUE: Prioritize ranked customer data if available ---
        # If we have ranked customer data, prepend it to the embedding context
        if query_requests_customer and ranked_customer_data:
            ranking_term = "Highest" if sort_reverse else "Lowest"
            field_term = "Spend" if sort_field_name == "total_spend" else "Order Count"
            ranking_desc = f"{ranking_term} {field_term}"
            
            # Safe access to sorted_customers - ensure it exists before trying to access it
            raw_ranked_customer = {}
            try:
                if 'sorted_customers' in locals() and sorted_customers and len(sorted_customers) > 0:
                    raw_ranked_customer = sorted_customers[0]
                else:
                    # If sorted_customers isn't available (e.g., intent detected by LLM), use what we have
                    raw_ranked_customer = ranked_customer_data
                    logger.debug("Using ranked_customer_data as raw_ranked_customer (sorted_customers not available)")
            except Exception as e:
                logger.warning(f"Error accessing sorted_customers: {str(e)}")
                raw_ranked_customer = ranked_customer_data
            
            # Create a comprehensive customer info block with all available fields
            customer_info = f"*** SPECIFIC REQUESTED CUSTOMER DETAILS ({ranking_desc}) ***\n"
            customer_info += f"  Customer ID: {raw_ranked_customer.get('customer_id', 'N/A')}\n"
            customer_info += f"  Name: {ranked_customer_data.get('customer_name', 'Unknown')}\n"
            customer_info += f"  Total Spend: {ranked_customer_data.get('total_spend', 'N/A')}\n"
            customer_info += f"  Total Orders: {ranked_customer_data.get('total_orders', 'N/A')}\n"
            customer_info += f"  Last Order Date: {raw_ranked_customer.get('last_order_date', 'N/A')}\n"
            customer_info += f"  Preferred Shipping Method: {ranked_customer_data.get('preferred_shipping_method', 'N/A')}\n"
            customer_info += f"  Preferred Payment Method: {raw_ranked_customer.get('preferred_payment_method', 'N/A')}\n"
            customer_info += f"  Country: {raw_ranked_customer.get('country', 'N/A')}\n\n"
            
            # Make sure embedding_context_text exists or initialize if not
            if 'embedding_context_text' not in locals() or not embedding_context_text:
                embedding_context_text = ""
                
            # Prepend this to the embedding context text only if it doesn't already contain the info
            if "*** SPECIFIC REQUESTED CUSTOMER DETAILS" not in embedding_context_text:
                embedding_context_text = customer_info + embedding_context_text
                logger.info(f"Prepended {ranking_desc} customer data to context: {ranked_customer_data.get('customer_name')}")
                
            # Update debug log to show all included fields
            logger.debug(f"Final prepended customer info: [{ranking_desc}] (ID: {raw_ranked_customer.get('customer_id', 'N/A')}, Name: {ranked_customer_data.get('customer_name', 'Unknown')}, Spend: {ranked_customer_data.get('total_spend', 'N/A')}, Orders: {ranked_customer_data.get('total_orders', 'N/A')})")
        # --- END IMPLEMENTATION CONTINUE ---
        
        # --- Add conditional system prompt instructions ---
        if query_requests_customer:
            reveal_instruction = "\n\nIMPORTANT: The user explicitly asked for details about a specific ranked customer. You MUST present the specific details (Customer ID, Name, Total Spend, Total Orders, Last Order Date, Preferred Shipping Method, Preferred Payment Method, Country) found in the context section labeled '*** SPECIFIC REQUESTED CUSTOMER DETAILS ***'. Do not summarize or omit these details for this specific request."
            system_message_dict["content"] += reveal_instruction
        else:
            # Optional: Add a general instruction to summarize PII if not already covered by persona
            summarize_instruction = "\n\nNOTE: When discussing customer data, summarize trends and avoid revealing specific individual customer details unless the user explicitly asks for a specific ranked individual (e.g., 'top spender')."
            # Check if persona already implies summarization, otherwise add instruction
            if intent not in ["Data Analysis"]: # Example: Add for non-analysis personas
                 system_message_dict["content"] += summarize_instruction
        # --- End conditional system prompt instructions ---
        
        # Append additional context to the system message content
        if additional_context:
             system_message_dict["content"] += additional_context

        # Add language instruction if needed
        if lang != 'en':
            # ... existing language instruction code ...
            if lang == 'es':
                 # Append instruction to the *end* of the system prompt content
                 system_message_dict["content"] += "\n\nIMPORTANT: Please respond in Spanish."
            # Add other languages as needed

        # === PLAN STEP 2: Enhance System Prompt with MongoDB Schema Overview ===
        # (REMOVED: static MONGODB_SCHEMA_OVERVIEW definitions)
        # Prepend the overview to the system message content
        system_message_dict["content"] = schema_overview + system_message_dict["content"]
        # === END PLAN STEP 2 ===

        # If we have Meta permission issues, append the notification to the system prompt
        if permission_notification_message:
            system_message_dict["content"] += f"\n\n--- Data Access Notification ---\n{permission_notification_message}\n--- End Notification ---"
            logger.debug(f"Added Meta permission notification to system prompt: {permission_notification_message[:100]}...")

        # --- END SYSTEM MESSAGE PREPARATION ---

        # Select processing function based on mode
        if mode == "think":
            response = await _process_think_request(
                message=user_query,
                image_data=image_data,
                conversation_history=formatted_messages_initial, # Pass initial history
                system_message=system_message_dict, # Pass the fully prepared system message
                user_langcode=lang
            )
        elif mode == "deepsearch":
            response = await _process_deepsearch_request(
                message=user_query,
                image_data=image_data,
                conversation_history=formatted_messages_initial,
                system_message=system_message_dict,
                user_langcode=lang
            )
        elif mode == "deepersearch":
             response = await _process_deepersearch_request(
                message=user_query,
                image_data=image_data,
                conversation_history=formatted_messages_initial,
                system_message=system_message_dict,
                user_langcode=lang
            )
        else: # Default mode
            response = await _process_default_request(
                message=user_query,
                image_data=image_data,
                conversation_history=formatted_messages_initial,
                system_message=system_message_dict,
                user_langcode=lang
            )
            
        # Return the final response, including context documents if available
        # The response from process functions should ideally be just the text string
        # We combine it with the context_documents gathered earlier
        return {
            "message": response, 
            "context_documents": context_documents,
            "meta_permission_error": has_meta_permission_error,
            "missing_permissions": missing_permissions_list
        }

    except Exception as e:
        logger.error(f"Error in get_chat_response: {e}", exc_info=True)
        # Return a generic error message in the expected dictionary format
        return {
            "message": "Sorry, an unexpected error occurred while processing your request.",
            "context_documents": [],
            "meta_permission_error": False,
            "missing_permissions": []
        }

META_CONTEXT_TTL_SECONDS = 3600 # 1 hour cache TTL

async def get_meta_context_for_store(store_id: Optional[str]) -> str:
    """Get Meta platform context for a store, prioritizing cache."""
    if not store_id:
        return ""

    logger.info(f"Fetching Meta context for store {store_id}")

    # --- Try fetching from meta_chat_context cache first ---
    try:
        cached_doc = await db_analysis["meta_chat_context"].find_one({"store_id": store_id})
        if cached_doc:
            last_updated = cached_doc.get("last_updated")
            is_fresh = False
            if isinstance(last_updated, datetime):
                if datetime.now(timezone.utc) - last_updated < timedelta(seconds=META_CONTEXT_TTL_SECONDS):
                    is_fresh = True
            
            if is_fresh:
                logger.info(f"Using cached meta_chat_context for store {store_id}")
                # --- Format context string from cached_doc ---
                context = "Meta Data Context (From Cache):\n"
                
                # Pages
                cached_pages = cached_doc.get("pages", [])
                context += "Pages:\n"
                if not cached_pages:
                    context += "  No Meta pages found.\n"
                else:
                    for page in cached_pages:
                        # Note: Follower count might not be directly in cached pages, adjust as needed
                        # Based on screenshot, followers are there
                        followers = page.get('followers', 'N/A')
                        context += f"  - {page.get('name', 'N/A')} ({page.get('platform', 'N/A')} ID: {page.get('id')}) Followers: {followers}\n"
                
                # Insights (Sample)
                cached_insights = cached_doc.get("insights", [])
                context += "Recent Insights (Sample):\n"
                if not cached_insights:
                    context += "  No recent insights found.\n"
                else:
                    for insight in cached_insights[:5]: # Sample first 5
                        insight_title = insight.get('title', 'N/A')[:60] + '...'
                        insight_type = insight.get('type', 'N/A')
                        insight_time = insight.get('date') # Use 'date' field from cached doc
                        insight_time_str = 'N/A'
                        if insight_time:
                             try:
                                 # Ensure it's datetime before formatting
                                 if isinstance(insight_time, datetime):
                                     insight_time_str = insight_time.strftime("%Y-%m-%d")
                                 else:
                                     insight_time_str = str(insight_time) # Use as string if not datetime
                             except Exception as fmt_e:
                                 logger.warning(f"Could not format insight date from cache: {insight_time} ({type(insight_time)}), Error: {fmt_e}")
                                 insight_time_str = 'Invalid Date'
                        context += f"    - [{insight_time_str} - {insight_type}]: {insight_title}\n"
                        
                # Engagement Metrics
                eng_metrics = cached_doc.get("engagement_metrics", {})
                context += "Engagement Metrics Summary:\n"
                context += f"  - Total Likes: {eng_metrics.get('total_likes', 0)}\n"
                context += f"  - Total Comments: {eng_metrics.get('total_comments', 0)}\n"
                context += f"  - Total Shares: {eng_metrics.get('total_shares', 0)}\n"
                context += f"  - Total Engagement: {eng_metrics.get('total_engagement', 0)}\n"
                
                # Audience Metrics
                aud_metrics = cached_doc.get("audience_metrics", {})
                context += "Audience Metrics Summary:\n"
                context += f"  - Total Followers: {aud_metrics.get('total_followers', 0)}\n"
                
                # Ad Metrics
                ad_metrics = cached_doc.get("ad_metrics", {})
                ad_accounts = ad_metrics.get("accounts", [])
                ad_campaigns = ad_metrics.get("campaigns", [])
                
                context += "Ad Performance Summary:\n"
                # Assuming ad_metrics in cache has a similar structure for summary, check existence
                ad_summary = ad_metrics.get("summary") # Check if a precomputed summary exists
                if ad_summary and isinstance(ad_summary, dict):
                     context += f"  - Overall: Spend: {ad_summary.get('total_spend', 0):.2f}, Impressions: {ad_summary.get('total_impressions', 0)}, Clicks: {ad_summary.get('total_clicks', 0)}\n"
                else: # Fallback: try to calculate from campaign data if no summary
                     total_spend = sum(c.get('spend', 0) for c in ad_campaigns if isinstance(c, dict))
                     # Need impressions/clicks from campaign level if available or metrics array
                     context += f"  - Overall Spend (from campaigns): {total_spend:.2f}\n"
                     context += f"  (Detailed overall ad metrics might require dynamic calculation if not pre-summarized in cache)\n"

                context += "Ad Accounts:\n"
                if not ad_accounts:
                    context += "  - No ad accounts linked.\n"
                else:
                    for account in ad_accounts:
                         if isinstance(account, dict): # Ensure it's a dict
                              context += f"  - {account.get('name', 'N/A')} (ID: {account.get('account_id')})\n"

                context += "Active/Recent Campaigns (Sample):\n"
                if not ad_campaigns:
                    context += "    - No recent campaigns found.\n"
                else:
                    for campaign in ad_campaigns[:5]: # Sample first 5
                         if isinstance(campaign, dict):
                              campaign_name = campaign.get('name', 'N/A')
                              campaign_status = campaign.get('status', 'N/A')
                              campaign_objective = campaign.get('objective', 'N/A')
                              campaign_spend = campaign.get('spend', 0)
                              context += f"      - {campaign_name} ({campaign_status}, {campaign_objective}): Spend {campaign_spend:.2f}\n"
                # --- End Formatting from cache ---
                return context # Return context generated from cache
            else:
                logger.warning(f"Cached meta_chat_context for store {store_id} is stale (updated: {last_updated}). Fetching fresh data.")
        else:
            logger.info(f"No fresh meta_chat_context found for store {store_id}. Fetching fresh data.")
            
    except Exception as cache_e:
        logger.error(f"Error fetching or processing meta_chat_context for store {store_id}: {cache_e}. Falling back to dynamic fetch.")

    # --- Fallback to dynamic fetching if cache miss or stale ---
    logger.info(f"Executing dynamic Meta context fetch for store {store_id}")
    try:
        # --- Existing dynamic fetch logic starts here ---
        # Use asyncio.gather to fetch data concurrently
        # Restore the full gather call
        results = await asyncio.gather(
            db_analysis["meta_pages"].find({"store_id": store_id}).to_list(length=None),
            db_analysis["meta_posts"].find({"store_id": store_id}).sort("created_time", -1).limit(100).to_list(length=100),
            db_analysis["meta_post_metrics"].aggregate([
                {"$match": {"store_id": store_id}},
                {"$group": {
                    "_id": None,
                    "total_likes": {"$sum": "$likes"},
                    "total_comments": {"$sum": "$comments"},
                    "total_impressions": {"$sum": "$impressions"}
                }}
            ]).to_list(length=1),
            # Fetch latest follower counts for each page
            db_analysis["meta_followers"].find({"store_id": store_id}).sort("page_id", 1).sort("date", -1).to_list(length=None),
            db_analysis["meta_insights"].find({"store_id": store_id}).sort("timestamp", -1).limit(50).to_list(length=50),
            db_analysis["meta_ad_campaigns"].find({"store_id": store_id}).sort("start_time", -1).limit(50).to_list(length=50),
            db_analysis["meta_ad_metrics"].aggregate([
                {"$match": {"store_id": store_id}},
                {"$group": {
                    "_id": None,
                    "total_spend": {"$sum": "$spend"},
                    "total_impressions": {"$sum": "$impressions"},
                    "total_clicks": {"$sum": "$clicks"},
                    "total_conversions": {"$sum": "$conversions"}
                }}
            ]).to_list(length=1),
            db_analysis["meta_sales_correlation"].find({"_id": store_id}).to_list(length=1),
            db_analysis["meta_ad_accounts"].find({"store_id": store_id}).to_list(length=None),
        )

        # Unpack results - Ensure this matches the gather call (9 items)
        meta_pages, meta_posts, post_metrics_agg, meta_followers_all, meta_insights, ad_campaigns, ad_metrics_agg, sales_correlation, ad_accounts = results

        # --- Existing formatting logic from unpacked results ---
        # Restore follower map logic
        followers_map = {}
        seen_page_ids_for_followers = set()
        if meta_followers_all:
            for follower_doc in meta_followers_all:
                page_id = follower_doc.get("page_id")
                if page_id and page_id not in seen_page_ids_for_followers:
                    followers_map[page_id] = follower_doc.get("total", 'N/A')
                    seen_page_ids_for_followers.add(page_id)

        context = "Meta Data Context (Dynamically Fetched):\n" # Indicate source
        context += "Pages:\n"
        if not meta_pages:
            context += "  No Meta pages found.\n"
        else:
            for page in meta_pages:
                page_id = page.get("id")
                followers = followers_map.get(page_id, 'N/A')
                context += f"  - {page.get('name', 'N/A')} ({page.get('platform', 'N/A')} ID: {page_id}): {followers} Followers\n"
        
        # --- Posts --- (including strftime fix)
        context += "Recent Posts (Last 90 days, up to 100):\n"
        if not meta_posts:
            context += "  No recent posts found.\n"
        else:
            context += f"  - Total Found: {len(meta_posts)}\n"
            # Restore calculation of averages
            post_metrics = post_metrics_agg[0] if post_metrics_agg else {}
            total_likes = post_metrics.get("total_likes", 0)
            total_comments = post_metrics.get("total_comments", 0)
            total_impressions = post_metrics.get("total_impressions", 0)
            avg_likes = round(total_likes / len(meta_posts)) if len(meta_posts) > 0 else 0
            avg_comments = round(total_comments / len(meta_posts)) if len(meta_posts) > 0 else 0
            avg_impressions = round(total_impressions / len(meta_posts)) if len(meta_posts) > 0 else 0
            context += f"  - Average Likes: {avg_likes}, Average Comments: {avg_comments}, Average Impressions: {avg_impressions}\n"
            context += "  - Sample (Last 5):\n"
            for post in meta_posts[:5]:
                post_message = post.get('message', 'No Message')[:100] + '...'
                post_time = post.get('created_time')
                try:
                    # Handle case where post_time could be a string or datetime
                    if isinstance(post_time, datetime):
                        post_time_str = post_time.strftime("%Y-%m-%d %H:%M:%S")
                    elif isinstance(post_time, str):
                        # Try to parse the string into a datetime first
                        try:
                            post_time_str = datetime.strptime(post_time, "%Y-%m-%dT%H:%M:%S%z").strftime("%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            # If parsing fails with ISO format, try other common formats
                            try:
                                post_time_str = datetime.strptime(post_time, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                # If all parsing fails, just use the string as is
                                post_time_str = post_time
                    else:
                        post_time_str = 'N/A'
                except Exception as e:
                    logger.warning(f"Error formatting post_time: {e}. Using 'N/A'.")
                    post_time_str = 'N/A'
                context += f"    - [{post_time_str}]: {post_message}\n"

        # --- Audience Summary --- 
        total_followers = sum(v for v in followers_map.values() if isinstance(v, (int, float)))
        context += "Audience Summary (Latest):\n"
        context += f"  - Total Followers (Across Pages): {total_followers}\n"

        # --- Ad Performance --- 
        context += "Ad Performance Summary (Last 90 days):\n"
        # Restore calculation of ad metrics
        ad_metrics = ad_metrics_agg[0] if ad_metrics_agg else {}
        total_spend = ad_metrics.get("total_spend", 0)
        total_impressions_ad = ad_metrics.get("total_impressions", 0)
        total_clicks = ad_metrics.get("total_clicks", 0)
        total_conversions = ad_metrics.get("total_conversions", 0)
        avg_ctr = round((total_clicks / total_impressions_ad) * 100, 2) if total_impressions_ad > 0 else 0
        avg_cpc = round(total_spend / total_clicks, 2) if total_clicks > 0 else 0
        avg_cost_per_conv = round(total_spend / total_conversions, 2) if total_conversions > 0 else 0
        context += f"  - Overall: Spend: {total_spend:.2f}, Impressions: {total_impressions_ad}, Clicks: {total_clicks}, Conversions: {total_conversions}, Avg CTR: {avg_ctr}%, Avg CPC: {avg_cpc:.2f}, Avg Cost/Conv: {avg_cost_per_conv:.2f}\n"
        context += "  - Active/Recent Campaigns (Up to 50):\n"
        # Restore listing campaigns
        if not ad_campaigns:
            context += "    - No recent campaigns found.\n"
        else:
            context += f"    - Total Found: {len(ad_campaigns)}\n"
            context += "    - Sample (Last 5):\n"
            for campaign in ad_campaigns[:5]:
                campaign_name = campaign.get('name', 'N/A')
                campaign_status = campaign.get('status', 'N/A')
                campaign_objective = campaign.get('objective', 'N/A')
                campaign_spend = campaign.get('spend', 0)
                context += f"      - {campaign_name} ({campaign_status}, {campaign_objective}): Spend {campaign_spend:.2f}\n"


        # --- Insights --- 
        context += "Recent Insights (Last 90 days, up to 50):\n"
        # Restore listing insights
        if not meta_insights:
            context += "  - No recent insights found.\n"
        else:
            context += f"  - Total Found: {len(meta_insights)}\n"
            context += "  - Sample (Last 5):\n"
            for insight in meta_insights[:5]:
                insight_title = insight.get('title', 'N/A')[:60] + '...'
                insight_type = insight.get('insight_type', 'N/A')
                insight_time = insight.get('timestamp')
                try:
                    # Handle case where insight_time could be a string or datetime
                    if isinstance(insight_time, datetime):
                        insight_time_str = insight_time.strftime("%Y-%m-%d")
                    elif isinstance(insight_time, str):
                        # Try to parse the string into a datetime first
                        try:
                            insight_time_str = datetime.strptime(insight_time, "%Y-%m-%d").strftime("%Y-%m-%d")
                        except ValueError:
                            # If parsing fails, just use the string as is
                            insight_time_str = insight_time
                    else:
                        insight_time_str = 'N/A'
                except Exception as e:
                    logger.warning(f"Error formatting insight_time: {e}. Using 'N/A'.")
                    insight_time_str = 'N/A'
                
                context += f"    - [{insight_time_str} - {insight_type}]: {insight_title}\n"
        
        # --- Sales Correlation --- 
        context += "Sales Correlation:\n"
        # Restore summarizing correlation
        sales_correlation_doc = sales_correlation[0] if sales_correlation else None
        if not sales_correlation_doc or "enhanced_campaigns" not in sales_correlation_doc:
             context += "  - No sales correlation data available.\n"
        else:
             context += f"  - Correlation analysis last updated: {sales_correlation_doc.get('last_updated')}\n"

        # --- Ad Accounts --- 
        context += "Ad Accounts:\n"
        # Restore listing ad accounts
        if not ad_accounts:
            context += "  - No ad accounts linked.\n"
        else:
            for account in ad_accounts:
                context += f"  - {account.get('name', 'N/A')} (ID: {account.get('account_id')})\n"

        logger.info(f"Successfully generated DYNAMIC Meta context for store {store_id}")
        return context
        # --- End of Existing dynamic fetch logic ---

    except Exception as e:
        logger.error(f"Error getting Meta context for store {store_id} (Dynamic Fetch): {str(e)}", exc_info=True)
        return "" # Return empty string on error

async def process_meta_query(query: str, store_id: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Process a Meta-related query and extract relevant data"""
    if not is_meta_related_query(query):
        return False, None
    
    try:
        # Extract entities from query
        entities = await extract_meta_entities(query)
        
        # Get relevant data based on entities
        data = {}
        
        if "page" in entities:
            # Get page data
            page = await db_analysis["meta_pages"].find_one({
                "store_id": store_id,
                "name": {"$regex": entities["page"], "$options": "i"}
            })
            
            if page:
                data["page"] = {
                    "id": page.get("id"),
                    "name": page.get("name"),
                    "category": page.get("category")
                }
        
        if "insight_type" in entities:
            # Get insights of specific type
            insights_cursor = db_analysis["meta_insights"].find({
                "store_id": store_id,
                "insight_type": {"$regex": entities["insight_type"], "$options": "i"}
            }).sort("timestamp", -1).limit(3)
            insights = await insights_cursor.to_list(length=None)
            
            if insights:
                data["insights"] = [{\
                    "type": insight.get("insight_type"),
                    "text": insight.get("insight_text"),
                    "recommendations": insight.get("recommendations", [])
                } for insight in insights]
        
        # Check if query is about ad metrics
        if any(term in query.lower() for term in ["ad metrics", "ad performance", "campaign", "advertising", "ads", "roi", "conversion"]):
            # Get ad metrics data
            page_id = data.get("page", {}).get("id")
            
            # If no specific page was mentioned, get the first page
            if not page_id and "page" not in entities:
                page = await db_analysis["meta_pages"].find_one({"store_id": store_id})
                if page:
                    page_id = page.get("id")
                    data["page"] = {
                        "id": page_id,
                        "name": page.get("name"),
                        "category": page.get("category")
                    }
            
            if page_id:
                ad_metrics = await db_analysis["meta_ad_metrics"].find_one({"page_id": page_id})
                if ad_metrics:
                    # Extract summary data
                    data["ad_metrics"] = {}
                    data["ad_metrics"]["summary"] = {
                        "total_spend": ad_metrics.get("account_summary", {}).get("total_spend", 0),
                        "total_impressions": ad_metrics.get("account_summary", {}).get("total_impressions", 0),
                        "total_clicks": ad_metrics.get("account_summary", {}).get("total_clicks", 0),
                        "total_conversions": ad_metrics.get("account_summary", {}).get("total_conversions", 0),
                        "average_roi": ad_metrics.get("account_summary", {}).get("average_roi", 0),
                        "campaign_count": len(ad_metrics.get("campaigns", []))
                    }
                    
                    # Extract campaign data if specifically asked
                    if any(term in query.lower() for term in ["campaign", "campaigns"]):
                        # Check for specific campaign by name
                        campaign_name = entities.get("ad_entity_name")
                        
                        # If a specific campaign name was asked for
                        if campaign_name:
                            logger.info(f"Looking for specific campaign: {campaign_name}")
                            # Check campaigns in meta object first
                            if ad_metrics.get("campaigns"):
                                found_campaign = False
                                for campaign in ad_metrics.get("campaigns", []):
                                    if not campaign or not isinstance(campaign, dict):
                                        continue
                                        
                                    if campaign.get("name") and campaign_name.lower() in campaign.get("name", "").lower():
                                        # Found matching campaign
                                        data["ad_metrics"]["specific_campaign"] = {
                                            "name": campaign.get("name"),
                                            "status": campaign.get("status", "Unknown"),
                                            "objective": campaign.get("objective", "Unknown"),
                                            "spend": campaign.get("spend", 0),
                                            "impressions": campaign.get("impressions", 0),
                                            "clicks": campaign.get("clicks", 0),
                                            "conversions": campaign.get("conversions", 0),
                                            "roi": campaign.get("roi", 0),
                                            "page_id": campaign.get("page_id", "")
                                        }
                                        found_campaign = True
                                        logger.info(f"Found campaign '{campaign.get('name')}' matching query '{campaign_name}'")
                                        break
                                        
                                if not found_campaign:
                                    # If still not found, check through all pages and their campaigns
                                    for page in data.get("pages", []):
                                        if "campaigns" in page:
                                            for campaign in page.get("campaigns", []):
                                                if not campaign or not isinstance(campaign, dict):
                                                    continue
                                                    
                                                if campaign.get("name") and campaign_name.lower() in campaign.get("name", "").lower():
                                                    # Found matching campaign
                                                    data["ad_metrics"]["specific_campaign"] = {
                                                        "name": campaign.get("name"),
                                                        "status": campaign.get("status", "Unknown"),
                                                        "objective": campaign.get("objective", "Unknown"),
                                                        "spend": campaign.get("spend", 0),
                                                        "impressions": campaign.get("impressions", 0),
                                                        "clicks": campaign.get("clicks", 0),
                                                        "conversions": campaign.get("conversions", 0),
                                                        "roi": campaign.get("roi", 0),
                                                        "page_id": page.get("id", "")
                                                    }
                                                    found_campaign = True
                                                    logger.info(f"Found campaign '{campaign.get('name')}' in page campaigns matching query '{campaign_name}'")
                                                    break
                                            
                                            if found_campaign:
                                                break
                        
                        # If no specific campaign was asked or found, include all campaigns
                        if not campaign_name or not data["ad_metrics"].get("specific_campaign"):
                            # Default behavior - use all campaigns
                            data["ad_metrics"]["campaigns"] = []
                            
                            # First check for campaigns in the meta object
                            if ad_metrics.get("campaigns"):
                                for campaign in ad_metrics.get("campaigns", []):
                                    if not campaign or not isinstance(campaign, dict):
                                        continue
                                        
                                    data["ad_metrics"]["campaigns"].append({
                                        "name": campaign.get("name", "Unknown Campaign"),
                                        "status": campaign.get("status", "Unknown"),
                                        "objective": campaign.get("objective", "Unknown"),
                                        "spend": campaign.get("spend", 0),
                                        "impressions": campaign.get("impressions", 0),
                                        "clicks": campaign.get("clicks", 0),
                                        "conversions": campaign.get("conversions", 0),
                                        "roi": campaign.get("roi", 0)
                                    })
                            
                            # Then check ad_metrics.campaigns
                            if ad_metrics and "campaigns" in ad_metrics:
                                for campaign in ad_metrics.get("campaigns", []):
                                    data["ad_metrics"]["campaigns"].append({
                                        "name": campaign.get("name"),
                                        "status": campaign.get("status"),
                                        "objective": campaign.get("objective"),
                                        "spend": campaign.get("metrics", {}).get("spend", 0),
                                        "impressions": campaign.get("metrics", {}).get("impressions", 0),
                                        "clicks": campaign.get("metrics", {}).get("clicks", 0),
                                        "conversions": campaign.get("metrics", {}).get("conversions", 0),
                                        "roi": campaign.get("metrics", {}).get("roi", 0)
                                    })
        
        return True, data
    except Exception as e:
        logger.error(f"Error processing Meta query: {str(e)}")
        return True, {"error": str(e)}

async def extract_meta_entities(query: str) -> Dict[str, str]:
    """Extract Meta-related entities from a query"""
    entities = {}
    
    # Extract page name
    page_patterns = [
        r"page\s+(?:called|named)\s+['\"]?([^'\"]+)['\"]?",
        r"['\"]([^'\"]+)['\"]?\s+page",
        r"for\s+(?:the\s+)?page\s+['\"]?([^'\"]+)['\"]?"
    ]
    
    for pattern in page_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            entities["page"] = match.group(1).strip()
            break
    
    # Extract insight type
    insight_patterns = [
        r"(content|audience|engagement|correlation|comment)\s+insights",
        r"insights\s+(?:about|on|for)\s+(content|audience|engagement|correlation|comments)"
    ]
    
    for pattern in insight_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            entities["insight_type"] = match.group(1).strip().lower()
            break
    
    # Extract campaign name specifically
    campaign_name_patterns = [
        r"(?:about|details\s+(?:for|about)|info\s+(?:for|about)|tell\s+me\s+about)\s+(?:the\s+)?(.*?)\s+campaign",
        r"(?:campaign|ad)\s+(?:called|named)\s+['\"]?([^'\"]+)['\"]?",
        r"['\"]([^'\"]+)['\"]?\s+(?:campaign|ad)",
        r"(?:what|how)\s+(?:about|did)\s+(?:the\s+)?(.*?)\s+campaign\s+(?:perform|do)",
        r"(?:campaign|ad)\s+\"([^\"]+)\"",
        r"(?:campaign|ad)\s+'([^']+)'",
        r"what\s+(?:is|was|about)\s+(?:the\s+)?(.*?)\s+campaign",
        r"how\s+(?:is|was)\s+(?:the\s+)?(.*?)\s+campaign\s+(?:doing|performing)"
    ]
    
    for pattern in campaign_name_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            campaign_name = match.group(1).strip()
            if campaign_name and len(campaign_name) > 3 and not campaign_name.lower() in ["this", "that", "your", "our", "my"]:
                entities["ad_entity_type"] = "campaign"
                entities["ad_entity_name"] = campaign_name
                break
    
    # Extract ad metrics related entities
    ad_metrics_patterns = [
        r"(roi|conversion|ctr|cpc|spend)\s+(?:for|of)\s+(?:the\s+)?(campaign|ad)",
        r"(active|paused|completed|deleted)\s+(campaign|ad)s?"
    ]
    
    for pattern in ad_metrics_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            if match.group(1).lower() in ["roi", "conversion", "ctr", "cpc", "spend"]:
                entities["ad_metric"] = match.group(1).lower()
                entities["ad_entity_type"] = match.group(2).lower()
            elif match.group(1).lower() in ["active", "paused", "completed", "deleted"]:
                entities["ad_status"] = match.group(1).lower()
                entities["ad_entity_type"] = match.group(2).lower()
            break
            
    # Check for specific campaigns by looking for known campaign names
    if "ad_entity_name" not in entities and "messaging campaign" in query.lower():
        # Try to extract campaign dates like "August 15"
        date_patterns = [
            r"messaging campaign.*?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d+)",
            r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d+).*?messaging campaign"
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                month = match.group(1).capitalize()
                day = match.group(2)
                campaign_name = f"Messaging Campaign - {month} {day}"
                entities["ad_entity_type"] = "campaign"
                entities["ad_entity_name"] = campaign_name
                break
    
    return entities

# Cache for store context
class StoreContextCache:
    def __init__(self):
        self._cache: Dict[str, dict] = {}
        self._last_updated: Dict[str, float] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._ttl = 60  # Reduce TTL to 1 minute to force more frequent refreshes
        self._background_tasks: Dict[str, asyncio.Task] = {}

    async def get(self, store_id: str, force_refresh: bool = False) -> Optional[dict]:
        """
        Get store context from cache if valid
        
        Args:
            store_id: The store ID
            force_refresh: If True, always return None to force a refresh
        """
        if force_refresh:
            logger.info(f"Forced refresh requested for store {store_id}")
            return None
            
        now = time.time()
        if store_id in self._cache and now - self._last_updated.get(store_id, 0) < self._ttl:
            return self._cache[store_id]
        return None

    async def set(self, store_id: str, context: dict):
        """Set store context in cache"""
        self._cache[store_id] = context
        self._last_updated[store_id] = time.time()

    async def invalidate(self, store_id: str):
        """Invalidate cache for a store"""
        if store_id in self._cache:
            del self._cache[store_id]
            if store_id in self._last_updated:
                del self._last_updated[store_id]

    def get_lock(self, store_id: str) -> asyncio.Lock:
        """Get or create a lock for a store"""
        if store_id not in self._locks:
            self._locks[store_id] = asyncio.Lock()
        return self._locks[store_id]

    async def start_background_sync(self, store_id: str):
        """Start background synchronization for a store"""
        if store_id not in self._background_tasks or self._background_tasks[store_id].done():
            self._background_tasks[store_id] = asyncio.create_task(
                self._background_sync_task(store_id)
            )

    async def stop_background_sync(self, store_id: str):
        """Stop background synchronization for a store"""
        if store_id in self._background_tasks:
            self._background_tasks[store_id].cancel()
            try:
                await self._background_tasks[store_id]
            except asyncio.CancelledError:
                pass
            del self._background_tasks[store_id]

    async def _background_sync_task(self, store_id: str):
        """Background task to keep store context up to date"""
        while True:
            try:
                # Check for changes in store data
                async with self.get_lock(store_id):
                    await self._check_and_update_store_data(store_id)
                
                # Wait for next sync interval
                await asyncio.sleep(60)  # Check every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background sync for store {store_id}: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying

    async def _check_and_update_store_data(self, store_id: str):
        """Check for changes in store data and update cache if needed"""
        try:
            # Get current data from database
            store_analysis = await db_analysis["global_analysis"].find_one({"_id": store_id})
            if not store_analysis:
                return

            # Also check meta_chat_context for changes
            meta_context = await db_analysis["meta_chat_context"].find_one({"store_id": store_id})
            meta_context_updated = False
            if meta_context and "last_updated" in meta_context:
                last_updated = meta_context["last_updated"]
                
                # Get cached data
                cached_context = await self.get(store_id)
                if cached_context:
                    # Compare last_updated timestamps if available
                    cached_meta = cached_context.get('meta', {})
                    cached_meta_data = cached_meta.get('ads', {})
                    if cached_meta_data and "last_updated" in cached_meta_data:
                        cached_updated = cached_meta_data["last_updated"]
                        if last_updated > cached_updated:
                            meta_context_updated = True
                            logger.info(f"Meta context for store {store_id} has been updated, forcing refresh")
            
            # Get cached data
            cached_context = await self.get(store_id)
            if not cached_context:
                # If no cache exists, build new context and cache it
                context = await build_complete_store_context(store_id)
                await self.set(store_id, context)
                return

            # Check for updates that require a full refresh
            needs_full_refresh = meta_context_updated
            
            # Always check for new chat history
            needs_update = False
            
            # Check for new chat history
            recent_chats_count = db_analysis["store_chats"].count_documents({"store_id": store_id})
            cached_chats_count = len(cached_context.get('recent_interactions', []))
            
            if recent_chats_count != cached_chats_count:
                needs_update = True
                logger.info(f"New chat history detected for store {store_id}, updating context")

            # If full refresh is needed, rebuild the entire context
            if needs_full_refresh:
                logger.info(f"Full refresh needed for store {store_id}, rebuilding context")
                context = await build_complete_store_context(store_id)
                await self.set(store_id, context)
                return
                
            # If only chat history changes detected, update only that part
            if needs_update:
                logger.info(f"Changes detected for store {store_id}, updating context")
                
                # Get recent chats
                recent_chats_cursor = db_analysis["store_chats"].find(
                    {"store_id": store_id},
                    {"messages": 1, "created_at": 1, "title": 1}
                ).sort("created_at", -1).limit(10)
                recent_chats = await recent_chats_cursor.to_list(length=None)
                
                # Update only the recent_interactions in cached context
                cached_context['recent_interactions'] = [
                    {
                        "title": chat.get("title", "Untitled"),
                        "created_at": chat.get("created_at"),
                        "message_count": len(chat.get("messages", []))
                    }
                    for chat in recent_chats
                ]
                
                # Update the cache with the modified context
                await self.set(store_id, cached_context)
                logger.info(f"Updated chat history for store {store_id}")

        except Exception as e:
            logger.error(f"Error checking store data for {store_id}: {str(e)}")

# Initialize the cache
store_context_cache = StoreContextCache()

def _sanitize_meta_data(meta_data: Dict) -> Dict:
    """Sanitize Meta data before logging"""
    sensitive_fields = ['access_token', 'user_id', 'email', 'phone']
    sanitized = meta_data.copy()
    for field in sensitive_fields:
        if field in sanitized:
            sanitized[field] = '***'
    return sanitized

async def get_active_shipping_methods(db_analysis: AsyncIOMotorDatabase) -> List[str]:
    """
    Fetches active shipping methods from platform_reference_data, excluding 'Acordar por whatsapp'.
    Returns a list of unique shipping method names.
    """
    try:
        doc = await db_analysis["platform_reference_data"].find_one({"_id": "reference"})
        if not doc or "shipping_methods" not in doc:
            return []
        methods = doc["shipping_methods"]
        filtered = [m["name"] for m in methods if m.get("active") == 1 and m.get("name", "").lower() != "acordar por whatsapp"]
        # Remove duplicates while preserving order
        seen = set()
        unique_methods = []
        for name in filtered:
            if name not in seen:
                unique_methods.append(name)
                seen.add(name)
        return unique_methods
    except Exception as e:
        logger.error(f"Error fetching shipping methods: {e}")
        return []

async def _analyze_request_for_individual_details(user_query: str, conversation_history: Optional[List[Dict]] = None) -> Tuple[bool, Optional[str], Optional[bool]]:
    """
    Analyzes the current query and recent conversation history to detect if the user is requesting 
    individual customer details with better context awareness than pure keyword matching.
    
    Args:
        user_query: The current user query text
        conversation_history: Optional list of recent conversation messages
        
    Returns:
        Tuple containing:
        - is_customer_detail_request (bool): Whether this is a request for specific customer details
        - sort_field (Optional[str]): Field to sort on ("total_spend" or "total_orders"), or None
        - sort_reverse (Optional[bool]): Whether to sort in descending (True) or ascending (False) order, or None
    """
    try:
        # For very obvious keyword matches, don't need to call LLM
        query_lower = user_query.lower()
        
        # If very clearly about best/top customers by keywords
        clear_best_patterns = [
            r"\btop\s+customer",
            r"\bbest\s+customer",
            r"\bhighest\s+spend",
            r"\bmost\s+valuable\s+customer",
            r"\bwho\s+buys\s+the\s+most",
            r"\bcustomer\s+with\s+most\s+purchase",
            r"\bcustomer\s+who\s+spend\s+most",
            r"\bcliente\s+que\s+más\s+gast[aó]",
            r"\bmejor\s+cliente",
            r"\bcliente\s+principal",
        ]
        
        # If very clearly about worst customers by keywords
        clear_worst_patterns = [
            r"\bworst\s+customer",
            r"\blowest\s+spend",
            r"\bleast\s+valuable\s+customer", 
            r"\bwho\s+buys\s+the\s+least",
            r"\bcustomer\s+with\s+least\s+purchase",
            r"\bcustomer\s+who\s+spend\s+least",
            r"\bcliente\s+que\s+menos\s+gast[aó]",
            r"\bpeor\s+cliente",
        ]
        
        # Check for obvious matches
        is_obvious_best = any(re.search(pattern, query_lower) for pattern in clear_best_patterns)
        is_obvious_worst = any(re.search(pattern, query_lower) for pattern in clear_worst_patterns)
        
        # For obvious cases, return immediately without LLM call
        if is_obvious_best:
            logger.debug(f"Obvious best customer query detected: '{user_query}'")
            return True, "total_spend", True  # True = customer detail request, total_spend field, sort descending
        elif is_obvious_worst:
            logger.debug(f"Obvious worst customer query detected: '{user_query}'")
            return True, "total_spend", False  # True = customer detail request, total_spend field, sort ascending
            
        # For less obvious cases, prepare for contextual LLM analysis
        # Extract recent conversation turns (up to 3) for context
        recent_turns = []
        if conversation_history:
            for msg in reversed(conversation_history[-6:]):  # Look at the last 6 messages max
                if len(recent_turns) >= 6:  # But only use up to 3 turns (user + assistant)
                    break
                    
                if isinstance(msg, dict) and msg.get("role") in ["user", "assistant"]:
                    content = msg.get("content", "")
                    # Handle both string and list content formats
                    if isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                content = part.get("text", "")
                                break
                    if content:
                        recent_turns.append({"role": msg["role"], "content": content})
        
        # Add the current query as the last turn
        recent_turns.append({"role": "user", "content": user_query})
        
        # Prepare LLM input
        if settings.OPENAI_API_KEY:  # Use settings.OPENAI_API_KEY
            # Prepare the system prompt
            system_prompt = """You are an expert analyst helping to detect user intent for a store analytics system. 
            Analyze if the user is asking for details about specific individual customers (like the top spender, customer who orders most frequently, etc.).
            Only respond 'yes' if the user is clearly asking about specific individual customers, otherwise respond 'no'.
            If yes, specify whether they want to know about the best/top customer (highest spend/most orders) or worst customer (lowest spend/fewest orders).
            Also specify whether to sort by total spend or total order count.
            Your response must be in valid JSON format like: {"is_customer_detail_request": true|false, "sort_field": "total_spend|total_orders|null", "sort_reverse": true|false|null}"""
            
            # Create the LLM client
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)  # Use settings.OPENAI_API_KEY
            
            # Make the LLM call
            response = await client.chat.completions.create(
                model="gpt-4.1-nano",  # Fast, efficient model for this simple task
                messages=[
                    {"role": "system", "content": system_prompt},
                    *recent_turns
                ],
                max_tokens=100,
                response_format={"type": "json_object"}
            )
            
            # Get the response content
            content = response.choices[0].message.content
            
            # Parse the response
            try:
                if content:  # Ensure content is not None before parsing
                    result = json.loads(content)
                    is_customer_detail_request = result.get("is_customer_detail_request", False)
                    sort_field = result.get("sort_field")
                    sort_reverse = result.get("sort_reverse")
                    
                    # Use default sort criteria if the request is true but criteria are not specified
                    if is_customer_detail_request:
                        if sort_field not in ["total_spend", "total_orders"]:
                            sort_field = "total_spend"  # Default to sorting by spend
                        if sort_reverse is None:
                            sort_reverse = True  # Default to showing highest value (descending sort)
                            
                    logger.debug(f"LLM customer intent analysis: '{user_query}' -> {result}")
                    return is_customer_detail_request, sort_field, sort_reverse
                else:
                    logger.error("Empty response from LLM")
                    return False, None, None
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse LLM response: {content}")
                # Fall back to default behavior
                return False, None, None
        else:
            logger.warning("OpenAI API key not available for intent analysis - using simple keyword fallback")
            # Fall back to keyword-based detection without OpenAI
            return False, None, None
            
    except Exception as e:
        logger.error(f"Error in _analyze_request_for_individual_details: {str(e)}", exc_info=True)
        # Fall back to default behavior on error
        return False, None, None

async def get_minimal_meta_context(store_id: Optional[str]) -> str:
    """Get a minimal Meta context for a store (pages & followers), prioritizing cache."""
    if not store_id:
        return ""

    # --- Try fetching minimal data from meta_chat_context cache first ---
    try:
        cached_doc = await db_analysis["meta_chat_context"].find_one({"store_id": store_id})
        if cached_doc:
            last_updated = cached_doc.get("last_updated")
            is_fresh = False
            if isinstance(last_updated, datetime):
                if datetime.now(timezone.utc) - last_updated < timedelta(seconds=META_CONTEXT_TTL_SECONDS):
                    is_fresh = True
            
            if is_fresh:
                logger.debug(f"Using cached meta_chat_context for minimal context (store {store_id})")
                # Extract only page info from the cached doc
                cached_pages = cached_doc.get("pages", [])
                context = "Meta Data Pages Summary (From Cache):\n"
                if not cached_pages:
                    context += "  No Meta pages found.\n"
                else:
                    for page in cached_pages:
                        followers = page.get('followers', 'N/A') # Followers should be in cached pages
                        context += f"  - {page.get('name', 'N/A')} ({page.get('platform', 'N/A')}): {followers} Followers\n"
                return context
            else:
                logger.debug(f"Cached meta_chat_context for minimal context is stale (store {store_id}). Fetching fresh.")
        else:
            logger.debug(f"No cache found for minimal context (store {store_id}). Fetching fresh.")

    except Exception as cache_e:
        logger.error(f"Error checking cache for minimal context: {cache_e}. Falling back.")

    # --- Fallback to dynamic fetching if cache miss or stale ---
    logger.debug(f"Executing dynamic minimal Meta context fetch for store {store_id}")
    try:
        # Just get the pages without detailed metrics
        meta_pages = await db_analysis["meta_pages"].find({"store_id": store_id}).to_list(length=None)
        
        # Quickly get basic followers count if available (Can be slow if many pages)
        followers_map = {}
        # Efficiently fetch latest follower counts for all pages in one go if possible
        # Example using aggregation (requires index on store_id, page_id, date)
        pipeline = [
            {"$match": {"store_id": store_id, "page_id": {"$in": [p.get("id") for p in meta_pages if p.get("id")]} }},
            {"$sort": {"date": -1}}, 
            {"$group": {"_id": "$page_id", "latest_count": {"$first": "$total"}}}
        ]
        follower_results = await db_analysis["meta_followers"].aggregate(pipeline).to_list(length=None)
        followers_map = {doc["_id"]: doc["latest_count"] for doc in follower_results}
        
        # Format a minimal context string - just the pages
        context = "Meta Data Pages Summary (Dynamically Fetched):\n"
        if not meta_pages:
            context += "  No Meta pages found.\n"
        else:
            for page in meta_pages:
                pid = page.get("id")
                followers = followers_map.get(pid, 'N/A')
                context += f"  - {page.get('name', 'N/A')} ({page.get('platform', 'N/A')}): {followers} Followers\n"
        
        return context
    
    except Exception as e:
        logger.error(f"Error getting minimal Meta context (Dynamic Fetch): {str(e)}")
        return ""

async def track_openai_cost(
    store_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    function_name: str = "chat",
    security_service: Optional[SecurityService] = None
) -> float:
    """Track cost for OpenAI API calls with current accurate pricing (January 2025)"""
    try:
        # Current OpenAI pricing as of January 2025 (per million tokens)
        pricing = {
            # GPT-4.1 series - current model
            "gpt-4.1-mini": {"input": 0.40, "output": 1.60},           # GPT-4.1 Mini (our default)
            
            # GPT-4o series - current available models
            "gpt-4o": {"input": 2.50, "output": 10.00},                # Standard GPT-4o
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},            # Mini version
            
            # o-series reasoning models
            "o4-mini": {"input": 1.10, "output": 4.40},                # Compact reasoning model
            "o3-mini": {"input": 1.10, "output": 4.40},                # Previous generation
            "o1-mini": {"input": 1.10, "output": 4.40},                # Legacy reasoning
            
            # Legacy models (higher costs)
            "gpt-4": {"input": 30.00, "output": 60.00},                # Legacy GPT-4
            "gpt-4-turbo": {"input": 10.00, "output": 30.00},          # GPT-4 Turbo
            "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},          # GPT-3.5 Turbo
        }
        
        # Normalize model name for lookup
        model_key = model.lower().replace("gpt-", "gpt-").replace("_", "-")
        
        if model_key not in pricing:
            # Default to GPT-4.1 Mini pricing for unknown models
            logger.warning(f"Unknown model {model}, using GPT-4.1 Mini pricing as fallback")
            model_key = "gpt-4.1-mini"
        
        model_pricing = pricing[model_key]
        
        # Handle missing usage data with fallback estimation
        if input_tokens == 0 and output_tokens == 0:
            logger.warning(f"Missing token usage data for {model}, estimating based on function type")
            # Fallback token estimation based on function type
            if function_name == "chat_summary":
                input_tokens = 100  # Estimated for summary requests
                output_tokens = 20  # Short summary output
            elif function_name == "chat_default":
                input_tokens = 500  # Average chat input
                output_tokens = 300  # Average chat response
            else:
                input_tokens = 200  # Conservative estimate
                output_tokens = 150  # Conservative estimate
            logger.info(f"Using fallback token estimates: {input_tokens} input + {output_tokens} output")
        
        # Calculate costs (pricing is per million tokens)
        input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (output_tokens / 1_000_000) * model_pricing["output"]
        total_cost = input_cost + output_cost
        
        # Track in database
        cost_record = {
            "store_id": store_id,
            "service": "openai",
            "model": model,
            "function": function_name,
            "date": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0),
            "timestamp": datetime.now(timezone.utc),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "input_cost_usd": input_cost,
            "output_cost_usd": output_cost,
            "total_cost_usd": total_cost,
            "request_count": 1,
            "estimated_tokens": input_tokens == 0 and output_tokens == 0  # Flag for estimated usage
        }
        
        # Store cost record
        await db_analysis["cost_tracking"].insert_one(cost_record)
        
        logger.info(f"Tracked OpenAI cost: ${total_cost:.6f} for {model} ({input_tokens}+{output_tokens} tokens)")
        
        # Track cost with SecurityService if available
        if security_service:
            try:
                # Use SecurityService for enhanced cost tracking
                await security_service.track_cost(
                    store_id=store_id,
                    service="openai",
                    cost=total_cost,
                    request_count=1
                )
                # Generate budget alerts if needed
                await _check_and_generate_budget_alerts(store_id, security_service)
                logger.debug(f"Cost tracking and budget alert check completed for store {store_id}: ${total_cost:.6f}")
            except Exception as e:
                logger.error(f"Failed to track cost via SecurityService: {e}")
        
        # Always track in cost_tracking collection as fallback
        return total_cost
        
    except Exception as e:
        logger.error(f"Failed to track OpenAI cost: {e}")
        return 0.0

async def check_cost_limits_before_request(store_id: str, estimated_tokens: int = 1000) -> Dict[str, Any]:
    """Check if request would exceed cost limits"""
    try:
        # Get store tier (you may need to implement this based on your store model)
        # For now, assume 'free' tier
        store_tier = "free"  # This should be fetched from store data
        
        # Estimate cost for the request
        estimated_cost = (estimated_tokens / 1000) * 0.001  # Conservative estimate
        
        # Check daily and monthly limits
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)
        
        # Get current costs
        daily_pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "service": "openai",
                    "date": {"$gte": today}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_cost": {"$sum": "$total_cost_usd"}
                }
            }
        ]
        
        monthly_pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "service": "openai",
                    "date": {"$gte": month_start}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_cost": {"$sum": "$total_cost_usd"}
                }
            }
        ]
        
        daily_result = await db_analysis["cost_tracking"].aggregate(daily_pipeline).to_list(1)
        monthly_result = await db_analysis["cost_tracking"].aggregate(monthly_pipeline).to_list(1)
        
        current_daily_cost = daily_result[0]["total_cost"] if daily_result else 0.0
        current_monthly_cost = monthly_result[0]["total_cost"] if monthly_result else 0.0
        
        # Define tier limits
        tier_limits = {
            "free": {"daily": 2.0, "monthly": 20.0},
            "basic": {"daily": 8.0, "monthly": 80.0},
            "premium": {"daily": 20.0, "monthly": 200.0},
            "enterprise": {"daily": 60.0, "monthly": 600.0}
        }
        
        limits = tier_limits.get(store_tier, tier_limits["free"])
        
        # Check if request would exceed limits
        new_daily_cost = current_daily_cost + estimated_cost
        new_monthly_cost = current_monthly_cost + estimated_cost
        
        return {
            "allowed": new_daily_cost <= limits["daily"] and new_monthly_cost <= limits["monthly"],
            "current_daily_cost": current_daily_cost,
            "current_monthly_cost": current_monthly_cost,
            "estimated_cost": estimated_cost,
            "daily_limit": limits["daily"],
            "monthly_limit": limits["monthly"],
            "daily_remaining": max(0, limits["daily"] - current_daily_cost),
            "monthly_remaining": max(0, limits["monthly"] - current_monthly_cost)
        }
        
    except Exception as e:
        logger.error(f"Error checking cost limits: {e}")
        return {"allowed": True}  # Allow request if check fails

async def track_openai_cost_per_model(
    store_id: str, 
    model: str, 
    input_tokens: int, 
    output_tokens: int, 
    operation_type: str = "chat"
) -> None:
    """Track OpenAI cost per model with accurate pricing"""
    try:
        # Calculate cost using updated pricing
        cost = await get_openai_cost_for_tokens(model, input_tokens, output_tokens)
        
        # Store cost tracking record
        cost_record = {
            "store_id": store_id,
            "service": "openai",
            "model": model,
            "operation_type": operation_type,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "cost_usd": cost,
            "timestamp": datetime.utcnow(),
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "hour": datetime.utcnow().strftime("%Y-%m-%d-%H")
        }
        
        await db_analysis.cost_tracking.insert_one(cost_record)
        
        # Update daily budget tracking
        today = datetime.utcnow().strftime("%Y-%m-%d")
        await db_analysis.cost_tracking.update_one(
            {"store_id": store_id, "date": today, "service": "openai_daily_total"},
            {"$inc": {"cost_usd": cost, "total_tokens": input_tokens + output_tokens}},
            upsert=True
        )
        
        logger.info(f"Tracked OpenAI cost: ${cost:.6f} for {model} ({input_tokens}+{output_tokens} tokens)")
        
    except Exception as e:
        logger.error(f"Failed to track OpenAI cost: {e}")
        # Don't raise exception to avoid blocking the main operation

async def check_budget_before_request(store_id: str, estimated_cost: float = 0.01) -> bool:
    """Check if store has budget available before making OpenAI request"""
    try:
        from datetime import datetime, timezone, timedelta
        
        # Get store tier and limits
        store_tier = await _get_store_tier(store_id)
        tier_limits = _get_tier_limits(store_tier)
        
        # Get current spending
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        
        # Check daily spending
        daily_pipeline = [
            {"$match": {"store_id": store_id, "date": today, "service": "openai"}},
            {"$group": {"_id": None, "total_cost": {"$sum": "$cost_usd"}}}
        ]
        daily_result = await db_analysis["cost_tracking"].aggregate(daily_pipeline).to_list(None)
        daily_cost = daily_result[0]["total_cost"] if daily_result else 0.0
        
        # Check monthly spending
        monthly_pipeline = [
            {"$match": {"store_id": store_id, "date": {"$regex": f"^{current_month}"}, "service": "openai"}},
            {"$group": {"_id": None, "total_cost": {"$sum": "$cost_usd"}}}
        ]
        monthly_result = await db_analysis["cost_tracking"].aggregate(monthly_pipeline).to_list(None)
        monthly_cost = monthly_result[0]["total_cost"] if monthly_result else 0.0
        
        # Check if adding estimated cost would exceed limits
        if (daily_cost + estimated_cost) > tier_limits["openai_daily_limit"]:
            logger.warning(f"Daily OpenAI budget exceeded for store {store_id}: ${daily_cost:.4f}/${tier_limits['openai_daily_limit']}")
            return False
            
        if (monthly_cost + estimated_cost) > tier_limits["openai_monthly_limit"]:
            logger.warning(f"Monthly OpenAI budget exceeded for store {store_id}: ${monthly_cost:.4f}/${tier_limits['openai_monthly_limit']}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to check budget for store {store_id}: {e}")
        return True  # Allow on error to avoid blocking legitimate requests

async def get_openai_cost_for_tokens(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Calculate cost for OpenAI API usage based on current pricing (January 2025)
    Uses accurate pricing for models we actually use in production
    """
    # Current OpenAI pricing as of January 2025 (per million tokens)
    pricing = {
        # GPT-4.1 series - current model
        "gpt-4.1-mini": {"input": 0.40, "output": 1.60},           # GPT-4.1 Mini (our default)
        
        # GPT-4o series - current available models
        "gpt-4o": {"input": 2.50, "output": 10.00},                # Standard GPT-4o
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},            # Mini version
        
        # o-series reasoning models
        "o4-mini": {"input": 1.10, "output": 4.40},                # Compact reasoning model
        "o3-mini": {"input": 1.10, "output": 4.40},                # Previous generation
        "o1-mini": {"input": 1.10, "output": 4.40},                # Legacy reasoning
        
        # Legacy models (higher costs)
        "gpt-4": {"input": 30.00, "output": 60.00},                # Legacy GPT-4
        "gpt-4-turbo": {"input": 10.00, "output": 30.00},          # GPT-4 Turbo
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},          # GPT-3.5 Turbo
    }
    
    # Normalize model name for lookup
    model_key = model.lower().replace("gpt-", "gpt-").replace("_", "-")
    
    if model_key not in pricing:
        # Default to GPT-4.1 Mini pricing for unknown models
        logger.warning(f"Unknown model {model}, using GPT-4.1 Mini pricing as fallback")
        model_key = "gpt-4.1-mini"
    
    model_pricing = pricing[model_key]
    
    # Calculate costs (pricing is per million tokens)
    input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
    output_cost = (output_tokens / 1_000_000) * model_pricing["output"]
    total_cost = input_cost + output_cost
    
    logger.info(f"Cost calculation for {model}: {input_tokens} input + {output_tokens} output = ${total_cost:.6f}")
    
    return total_cost

async def check_store_tier_limits(store_id: str, estimated_cost: float = 0.0) -> Union[bool, Dict[str, Any]]:
    """
    Get current usage and limits for store tier.
    
    Args:
        store_id: The store ID to check limits for
        estimated_cost: Optional estimated cost to validate against limits.
                       If provided > 0, returns boolean indicating if request is allowed.
                       If 0 or not provided, returns detailed Dict with usage information.
    
    Returns:
        bool: When estimated_cost > 0, returns True if request is within limits, False otherwise
        Dict: When estimated_cost is 0, returns detailed usage and limits information
    """
    try:
        from datetime import datetime, timezone
        
        store_tier = await _get_store_tier(store_id)
        tier_limits = _get_tier_limits(store_tier)
        
        # Get current usage
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        
        # Daily usage
        daily_pipeline = [
            {"$match": {"store_id": store_id, "date": today}},
            {"$group": {
                "_id": "$service",
                "total_cost": {"$sum": "$cost_usd"},
                "request_count": {"$sum": {"$ifNull": ["$request_count", 1]}}
            }}
        ]
        daily_usage = await db_analysis["cost_tracking"].aggregate(daily_pipeline).to_list(None)
        
        # Monthly usage
        monthly_pipeline = [
            {"$match": {"store_id": store_id, "date": {"$regex": f"^{current_month}"}}},
            {"$group": {
                "_id": "$service", 
                "total_cost": {"$sum": "$cost_usd"},
                "request_count": {"$sum": {"$ifNull": ["$request_count", 1]}}
            }}
        ]
        monthly_usage = await db_analysis["cost_tracking"].aggregate(monthly_pipeline).to_list(None)
        
        # Format usage data
        daily_openai = next((u for u in daily_usage if u["_id"] == "openai"), {"total_cost": 0, "request_count": 0})
        monthly_openai = next((u for u in monthly_usage if u["_id"] == "openai"), {"total_cost": 0, "request_count": 0})
        
        # If estimated_cost is provided, validate against limits and return boolean
        if estimated_cost > 0:
            current_daily_cost = daily_openai["total_cost"]
            current_monthly_cost = monthly_openai["total_cost"]
            
            # Check if adding estimated cost would exceed daily limit
            if (current_daily_cost + estimated_cost) > tier_limits["openai_daily_limit"]:
                logger.warning(f"Daily OpenAI budget would be exceeded for store {store_id}: ${current_daily_cost:.4f} + ${estimated_cost:.4f} > ${tier_limits['openai_daily_limit']}")
                return False
                
            # Check if adding estimated cost would exceed monthly limit  
            if (current_monthly_cost + estimated_cost) > tier_limits["openai_monthly_limit"]:
                logger.warning(f"Monthly OpenAI budget would be exceeded for store {store_id}: ${current_monthly_cost:.4f} + ${estimated_cost:.4f} > ${tier_limits['openai_monthly_limit']}")
                return False
                
            # Request is within limits
            logger.info(f"Request within limits for store {store_id}: daily ${current_daily_cost:.4f} + ${estimated_cost:.4f} <= ${tier_limits['openai_daily_limit']}, monthly ${current_monthly_cost:.4f} + ${estimated_cost:.4f} <= ${tier_limits['openai_monthly_limit']}")
            return True
        
        # Otherwise, return detailed information (original behavior)
        return {
            "store_tier": store_tier,
            "limits": tier_limits,
            "usage": {
                "daily": {
                    "openai_cost": daily_openai["total_cost"],
                    "openai_requests": daily_openai["request_count"],
                    "total_cost": sum(u["total_cost"] for u in daily_usage)
                },
                "monthly": {
                    "openai_cost": monthly_openai["total_cost"],
                    "openai_requests": monthly_openai["request_count"],
                    "total_cost": sum(u["total_cost"] for u in monthly_usage)
                }
            },
            "remaining": {
                "daily_openai": max(0, tier_limits["openai_daily_limit"] - daily_openai["total_cost"]),
                "monthly_openai": max(0, tier_limits["openai_monthly_limit"] - monthly_openai["total_cost"])
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to check store tier limits for {store_id}: {e}")
        # Return type based on whether estimated_cost was provided
        if estimated_cost > 0:
            return True  # Allow on error to avoid blocking legitimate requests
        else:
            return {"error": str(e)}

async def _get_store_tier(store_id: str) -> str:
    """Get store subscription tier from database"""
    try:
        # Check if store has premium features
        store_analysis = await db_analysis["global_analysis"].find_one({"_id": store_id})
        if store_analysis and store_analysis.get("premium_tier"):
            return store_analysis["premium_tier"]
        
        # Default to free tier
        return "free"
        
    except Exception as e:
        logger.error(f"Failed to get store tier for {store_id}: {e}")
        return "free"

def _get_tier_limits(tier: str) -> Dict[str, float]:
    """Get cost limits for store tier"""
    tier_limits = {
        "free": {
            "daily_limit": 5.0,
            "monthly_limit": 50.0,
            "openai_daily_limit": 2.0,
            "openai_monthly_limit": 20.0,
            "meta_api_daily_limit": 1.0,
            "meta_api_monthly_limit": 10.0
        },
        "basic": {
            "daily_limit": 20.0,
            "monthly_limit": 200.0,
            "openai_daily_limit": 10.0,
            "openai_monthly_limit": 100.0,
            "meta_api_daily_limit": 5.0,
            "meta_api_monthly_limit": 50.0
        },
        "premium": {
            "daily_limit": 100.0,
            "monthly_limit": 1000.0,
            "openai_daily_limit": 50.0,
            "openai_monthly_limit": 500.0,
            "meta_api_daily_limit": 25.0,
            "meta_api_monthly_limit": 250.0
        },
        "enterprise": {
            "daily_limit": 500.0,
            "monthly_limit": 5000.0,
            "openai_daily_limit": 250.0,
            "openai_monthly_limit": 2500.0,
            "meta_api_daily_limit": 100.0,
            "meta_api_monthly_limit": 1000.0
        }
    }
    
    return tier_limits.get(tier, tier_limits["free"])

async def _check_and_generate_budget_alerts(store_id: str, security_service) -> None:
    """Check if budget alerts should be generated based on current spending and log them."""
    try:
        from models.security import BudgetAlert
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)
        # Daily cost aggregation
        daily_pipeline = [
            {"$match": {"store_id": store_id, "service": "openai", "date": {"$gte": today}}},
            {"$group": {"_id": None, "total_cost": {"$sum": "$total_cost_usd"}}}
        ]
        daily_result = await db_analysis["cost_tracking"].aggregate(daily_pipeline).to_list(1)
        current_daily_cost = daily_result[0]["total_cost"] if daily_result else 0.0
        # Monthly cost aggregation
        monthly_pipeline = [
            {"$match": {"store_id": store_id, "service": "openai", "date": {"$gte": month_start}}},
            {"$group": {"_id": None, "total_cost": {"$sum": "$total_cost_usd"}}}
        ]
        monthly_result = await db_analysis["cost_tracking"].aggregate(monthly_pipeline).to_list(1)
        current_monthly_cost = monthly_result[0]["total_cost"] if monthly_result else 0.0
        # Limits (could be dynamic per store)
        daily_limit = 2.0
        monthly_limit = 20.0
        # Daily alert
        daily_pct = current_daily_cost / daily_limit if daily_limit > 0 else 0
        if daily_pct >= 0.8:
            alert_type = "critical" if daily_pct >= 0.95 else "warning"
            alert = BudgetAlert(
                alert_id=f"daily_{store_id}_{today.strftime('%Y%m%d')}",
                store_id=store_id,
                alert_type=f"daily_{alert_type}",
                current_amount=current_daily_cost,
                threshold=daily_limit,
                percentage_used=daily_pct
            )
            await security_service.log_budget_alert(alert)
        # Monthly alert
        monthly_pct = current_monthly_cost / monthly_limit if monthly_limit > 0 else 0
        if monthly_pct >= 0.8:
            alert_type = "critical" if monthly_pct >= 0.95 else "warning"
            alert = BudgetAlert(
                alert_id=f"monthly_{store_id}_{month_start.strftime('%Y%m')}",
                store_id=store_id,
                alert_type=f"monthly_{alert_type}",
                current_amount=current_monthly_cost,
                threshold=monthly_limit,
                percentage_used=monthly_pct
            )
            await security_service.log_budget_alert(alert)
    except Exception as e:
        logger.error(f"Failed to check/generate budget alerts for store {store_id}: {e}")