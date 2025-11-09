"""
Market Analysis Utilities
Provides AI-powered analysis of market relationships and correlations
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.market_schema import Market
from app.utils.openai_service import OpenAIHelper
import logging

logger = logging.getLogger(__name__)


class MarketCorrelationAnalysis(BaseModel):
    """Schema for comprehensive AI-generated market correlation analysis"""
    correlation_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Correlation strength (0.0-1.0). High score = strong relationship (causation OR prevention/contradiction)"
    )
    explanation: str = Field(
        ..., 
        description="Brief explanation (2-3 sentences) of how the events relate (positive causation or inverse/prevention)"
    )
    investment_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Arbitrage opportunity score (0-1) based on price differentials and correlation. Higher = better arbitrage potential"
    )
    investment_rationale: str = Field(
        ...,
        description="Explanation of arbitrage opportunity considering price differentials and market conditions"
    )
    risk_level: Literal["low", "medium", "high"] = Field(
        ...,
        description="Risk assessment based on volatility and market conditions"
    )


async def analyze_market_correlation(
    market1: Market,
    market2: Market,
    model: str = "gemini-2.0-flash"
) -> MarketCorrelationAnalysis:
    """
    Use AI to analyze if two markets influence each other, with arbitrage opportunity scoring.
    
    This function analyzes:
    - Correlation strength: How strongly related are the events? (causation OR prevention/contradiction)
    - Arbitrage opportunity: Based on price differentials, correlation, and volatility
    - Risk assessment: Based on volatility patterns
    
    Note: High correlation includes BOTH positive causation (Event 2 causes Event 1) 
    AND inverse relationships (Event 2 prevents/contradicts Event 1).
    
    Args:
        market1: First market (Event 1)
        market2: Second market (Event 2)
        model: AI model to use ("gemini-flash" for speed, "gemini-pro" for quality)
        
    Returns:
        MarketCorrelationAnalysis with correlation, arbitrage score (0-1), and risk level
        
    Example:
        >>> market1 = await db.get_market_by_id(123)  # "None leave cabinet in 2025"
        >>> market2 = await db.get_market_by_id(456)  # "First to leave: Scott Bessent"
        >>> analysis = await analyze_market_correlation(market1, market2)
        >>> print(f"Correlation: {analysis.correlation_score}")  # ~1.0 (mutually exclusive)
        >>> print(f"Arbitrage Score: {analysis.investment_score}")
        >>> print(f"Risk: {analysis.risk_level}")
    
    Raises:
        ValueError: If model is not a supported Gemini model
    """
    # Validate model
    VALID_MODELS = [
        "gemini-flash",
        "gemini-pro", 
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-2.0-flash-thinking-exp",
        "gemini-1.5-flash",
        "gemini-1.5-flash-002"
    ]
    
    if model not in VALID_MODELS:
        raise ValueError(
            f"Invalid model '{model}'. Supported models: {', '.join(VALID_MODELS)}. "
            f"Use 'gemini-flash' for speed or 'gemini-pro' for quality."
        )
    
    # Map convenience names to actual model names
    MODEL_MAPPING = {
        "gemini-flash": "gemini-2.0-flash-exp",
        "gemini-pro": "gemini-2.0-flash-thinking-exp"
    }
    
    actual_model = MODEL_MAPPING.get(model, model)
    
    # Calculate volatility for both markets
    def calculate_volatility(market: Market) -> float:
        """Calculate average volatility from price changes"""
        changes = []
        if market.one_day_price_change is not None:
            changes.append(abs(market.one_day_price_change))
        if market.one_week_price_change is not None:
            changes.append(abs(market.one_week_price_change))
        if market.one_month_price_change is not None:
            changes.append(abs(market.one_month_price_change))
        return sum(changes) / len(changes) if changes else 0.0
    
    volatility1 = calculate_volatility(market1)
    volatility2 = calculate_volatility(market2)
    
    # Build comprehensive context for both markets
    market1_context = f"""Market 1: {market1.question}"""
    if market1.description:
        market1_context += f"\nDescription: {market1.description}"
    market1_context += f"\nOutcome Prices: {', '.join(market1.outcome_prices) if market1.outcome_prices else 'N/A'}"
    market1_context += f"\nVolume: ${market1.volume:,.2f}"
    market1_context += f"\nVolatility (avg price change): {volatility1:.2%}"
    if market1.one_day_price_change is not None:
        market1_context += f"\n24h Change: {market1.one_day_price_change:+.2%}"
    if market1.one_week_price_change is not None:
        market1_context += f"\n7d Change: {market1.one_week_price_change:+.2%}"
    
    market2_context = f"""Market 2: {market2.question}"""
    if market2.description:
        market2_context += f"\nDescription: {market2.description}"
    market2_context += f"\nOutcome Prices: {', '.join(market2.outcome_prices) if market2.outcome_prices else 'N/A'}"
    market2_context += f"\nVolume: ${market2.volume:,.2f}"
    market2_context += f"\nVolatility (avg price change): {volatility2:.2%}"
    if market2.one_day_price_change is not None:
        market2_context += f"\n24h Change: {market2.one_day_price_change:+.2%}"
    if market2.one_week_price_change is not None:
        market2_context += f"\n7d Change: {market2.one_week_price_change:+.2%}"
    
    system_message = """You are an expert analyst evaluating prediction markets for causal relationships and ARBITRAGE opportunities.

Your task has THREE parts:

1. CORRELATION SCORE (0.0-1.0): How strongly are Event 2 and Event 1 related? This includes BOTH positive causation AND negative/inverse relationships.
   - 0.0-0.3: Little/no relationship (independent events)
   - 0.4-0.6: Moderate relationship (some indirect influence)
   - 0.7-0.9: Strong relationship (direct causation OR direct prevention/contradiction)
   - 1.0: Absolute relationship (guarantees Event 1 OR makes Event 1 impossible)
   
   **IMPORTANT**: If Event 2 happening PREVENTS or CONTRADICTS Event 1 (makes it impossible), this is a STRONG correlation (0.8-1.0).
   Examples:
   - "First cabinet member to leave" vs "None leave in 2025" → Score ~1.0 (mutually exclusive, perfect inverse)
   - "Bitcoin hits $100k" ← "Bitcoin ETF approved" → Score ~0.8 (positive causation)

2. INVESTMENT SCORE (0.0-1.0): ARBITRAGE opportunity score based on:
   - **Price Differentials** (MOST IMPORTANT): Large price differences = high opportunity. Same/similar prices = LOW opportunity (0.0-0.2)
   - Correlation strength: Strong correlation + price difference = arbitrage potential
   - Volatility: Higher volatility = more price movement opportunities
   - Volume/liquidity: Sufficient volume for execution
   
   Scoring:
   - 0.8-1.0: Excellent arbitrage (strong correlation + large price differential + good volatility)
   - 0.5-0.7: Moderate arbitrage (some price differential exists)
   - 0.0-0.4: Poor/no arbitrage (similar prices, weak correlation, or unfavorable conditions)
   
   **CRITICAL**: If markets have the same or very similar prices, score MUST be low (0.0-0.2) as there's no arbitrage opportunity.

3. RISK LEVEL (low/medium/high): Based on volatility and market conditions
   - Low: Volatility < 5%, stable markets
   - Medium: Volatility 5-15%, moderate fluctuations
   - High: Volatility > 15%, highly volatile

Provide concise explanations (2-3 sentences each) for correlation and investment rationale. Focus on PRICE DIFFERENTIALS for arbitrage."""
  
    prompt = f"""{market1_context}

{market2_context}

Analyze these markets for ARBITRAGE opportunities:
1. Assess CORRELATION: How strongly related are these events? Consider:
   - Does Event 2 CAUSE Event 1? (positive correlation)
   - Does Event 2 PREVENT/CONTRADICT Event 1? (inverse correlation - still HIGH score!)
   - Are they mutually exclusive or logically related?
   
2. Rate ARBITRAGE opportunity: Focus on PRICE DIFFERENTIALS first, then correlation and volatility. If prices are the same/similar, score MUST be very low (0.0-0.2).

3. Assess risk level: Based on volatility patterns

**CRITICAL**: If Event 2 makes Event 1 impossible (contradiction/prevention), correlation score should be HIGH (0.8-1.0), not low!

Provide correlation_score, explanation, investment_score, investment_rationale, and risk_level."""
    
    # Create AI helper with selected model
    openai_helper = OpenAIHelper(chat_model=actual_model)
    
    # Get AI analysis
    analysis = await openai_helper.get_structured_output(
        prompt=prompt,
        response_model=MarketCorrelationAnalysis,
        system_message=system_message
    )
    
    return analysis

