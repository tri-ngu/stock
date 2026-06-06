import random
import yfinance as yf
import numpy as np
from typing import Dict, List, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Risk tier sets — used by compute_portfolio_weights
_GROWTH_TICKERS = frozenset([
    'NVDA', 'AMD', 'META', 'TSLA', 'NFLX', 'AMZN', 'GOOGL', 'AAPL', 'MSFT',
    'AVGO', 'CRM', 'ADBE', 'ORCL', 'QCOM', 'INTC', 'QQQ',
])
_BOND_ETFS = frozenset([
    'BND', 'AGG', 'LQD', 'TLT', 'IEF', 'SHV', 'HYG', 'TIP',
    'MUB', 'VCIT', 'VCSH', 'BSV',
])
_DIVERSIFIED_ETFS = frozenset([
    'VTI', 'VOO', 'SPY', 'IVV', 'SCHB', 'VIG', 'DGRO', 'NOBL', 'DVY',
])

# Sector map — used for round-robin diversity selection in build_portfolio_recommendation
_TICKER_SECTOR = {
    **{t: 'tech'         for t in ['NVDA','META','GOOGL','AMZN','AMD','AVGO','ORCL','CRM','ADBE','NFLX','QCOM','TSLA','INTC','MSFT','AAPL']},
    **{t: 'healthcare'   for t in ['LLY','UNH','ABBV','TMO','ABT','MDT','AMGN','GILD','REGN','VRTX','BMY','CI','HUM','JNJ','MRK']},
    **{t: 'finance'      for t in ['BLK','GS','JPM','MS','AXP','COF','PGR','ICE','CME','SPGI','CB','TRV','PRU','BAC','SCHW','V','MA']},
    **{t: 'energy'       for t in ['EOG','COP','HES','DVN','OXY','MPC','VLO','PSX','KMI','WMB','SLB','HAL','XOM','CVX','ET']},
    **{t: 'consumer'     for t in ['COST','HD','LOW','TGT','NKE','SBUX','YUM','DG','DLTR','MCD','PG','KO','PEP','CL','WMT']},
    **{t: 'bonds'        for t in ['BND','AGG','LQD','TLT','IEF','SHV','HYG','TIP','MUB','VCIT','VCSH','BSV']},
    **{t: 'real_estate'  for t in ['PLD','AMT','EQIX','CCI','PSA','VNQ','O','AVB','EXR','SPG']},
    **{t: 'international'for t in ['VXUS','EFA','VWO','IEFA','VEA','EEM','IEMG','DGS','SPDW','ACWX']},
    **{t: 'diversified'  for t in ['VTI','VOO','SPY','IVV','SCHB','VIG','DGRO','NOBL','DVY','QQQ']},
}

# ── Per-ticker editorial analysis ─────────────────────────────────────────────
_TICKER_ANALYSIS = {
    'NVDA': {
        'headline': 'The AI buildout demands scale; NVIDIA owns the only infrastructure that can deliver it.',
        'why_this_stock': (
            "GPU demand for AI training and inference is supply-constrained through 2026, giving NVIDIA unusual earnings visibility for a high-beta name. "
            "No competitor has comparable data center market share or the CUDA software ecosystem that creates deep customer switching costs. "
            "Revenue has fundamentally shifted from gaming to enterprise AI infrastructure, making this a structural growth story rather than a cyclical trade. "
            "The Blackwell architecture cycle locks in elevated ASPs across the hyperscaler customer base for multiple years."
        ),
        'sector_role': "Primary Technology driver — anchors the portfolio's secular AI infrastructure exposure with highest conviction.",
        'peers': [
            {'ticker': 'AMD',  'note': "→ AMD's near-term projections look competitive, but NVDA's data center moat and CUDA lock-in justify the premium multiple over any 2-year horizon."},
            {'ticker': 'INTC', 'note': "→ Intel trades far cheaper but years of execution failures and continued share losses make it a value trap, not a value opportunity."},
            {'ticker': 'AVGO', 'note': "→ Broadcom is a strong AI custom-silicon play; both serve the AI theme, but NVDA has broader applicability across training and inference workloads."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'AMD',  'text': "CUDA ecosystem and data center moat create switching costs AMD cannot replicate despite competitive near-term estimates."},
            {'type': 'prefer', 'ticker': 'INTC', 'text': "Intel's discount reflects real deterioration — no credible roadmap exists to reclaim lost AI market share from NVDA."},
            {'type': 'consider', 'ticker': 'AVGO', 'text': "Consider Broadcom for custom AI chip exposure at a lower multiple; both could complement rather than substitute each other."},
        ],
    },
    'MSFT': {
        'headline': 'Cloud and AI infrastructure at enterprise scale — Microsoft is the platform that compounds quietly.',
        'why_this_stock': (
            "Azure is the second-largest cloud platform and gaining share against AWS, driven by enterprises already embedded in Microsoft's productivity stack. "
            "Copilot monetisation across Office 365 converts high seat counts to higher-priced AI tiers faster than any other vendor. "
            "The operating model generates over $75B in annual free cash flow, funding both R&D and capital returns simultaneously without leverage. "
            "At roughly 36x earnings, the multiple reflects durable competitive advantages in productivity, cloud, and gaming that rarely trade at a discount."
        ),
        'sector_role': "Technology anchor — stable, high-margin cloud growth with lower volatility than pure AI hardware plays.",
        'peers': [
            {'ticker': 'GOOGL', 'note': "→ Alphabet is the primary cloud and AI research competitor; MSFT's enterprise distribution makes it the more predictable compounder for a core portfolio position."},
            {'ticker': 'AMZN',  'note': "→ AWS leads in cloud market share, but MSFT's enterprise agreements create stickier switching costs than AWS's primarily technical moat."},
            {'ticker': 'NVDA',  'note': "→ NVDA is the hardware layer powering MSFT's AI services — complementary exposures rather than competing portfolio choices."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'GOOGL', 'text': "MSFT's enterprise integration and Office 365 distribution create more predictable revenue streams than Google's advertising-dominant business model."},
            {'type': 'prefer', 'ticker': 'AMZN',  'text': "MSFT's recurring enterprise contracts provide more earnings predictability than Amazon's retail-driven margin structure."},
            {'type': 'consider', 'ticker': 'NVDA',  'text': "Add NVDA alongside MSFT rather than substituting — both serve the AI theme at different stack layers with low correlation."},
        ],
    },
    'AAPL': {
        'headline': "Services flywheel and installed base loyalty make Apple the most durable consumer franchise in tech.",
        'why_this_stock': (
            "Apple's installed base of 2.2B+ active devices creates a compounding services revenue stream — App Store, iCloud, and Apple Pay — now contributing over 25% of revenue at near-80% gross margins. "
            "iPhone upgrade cycles are lengthening but the revenue mix shift to high-margin services more than offsets volume pressure, improving overall earnings quality. "
            "Vision Pro and Apple Intelligence represent nascent optionality that isn't priced in at current multiples. "
            "The balance sheet is fortress-quality with $162B in net cash supporting a $100B+ annual buyback program that mechanically reduces share count."
        ),
        'sector_role': "Portfolio stabilizer in Technology — lower beta than peers, large-cap quality anchor with dividend and buyback support.",
        'peers': [
            {'ticker': 'MSFT', 'note': "→ MSFT's cloud growth is faster and AI monetisation more direct; AAPL's services moat is deeper in consumer but slower to AI-inflate earnings."},
            {'ticker': 'GOOGL', 'note': "→ Alphabet competes via Android; AAPL's closed ecosystem commands premium pricing and loyalty that Google's open platform structurally cannot match."},
            {'ticker': 'AMZN',  'note': "→ Amazon's AWS and advertising growth are faster; AAPL's consumer hardware stickiness is unique but the growth profile is fundamentally different."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'GOOGL', 'text': "AAPL's closed ecosystem and hardware-software integration command a loyalty premium that Alphabet's open Android platform structurally cannot replicate."},
            {'type': 'prefer', 'ticker': 'AMZN',  'text': "AAPL's $100B+ annual capital return program and services margin profile make it the better hold in a risk-off environment."},
            {'type': 'consider', 'ticker': 'MSFT',  'text': "MSFT offers faster near-term earnings growth from cloud and AI; consider weighting higher if cloud exposure is the primary thesis."},
        ],
    },
    'GOOGL': {
        'headline': "Search, cloud, and AI research — Alphabet's moats are deeper than its valuation implies.",
        'why_this_stock': (
            "Google Search retains 90%+ query market share despite AI disruption concerns, and AI Overviews are increasing ad revenue per query rather than cannibalising it. "
            "Google Cloud is growing 28%+ annually and approaching profitability at scale, providing a second earnings engine separate from advertising. "
            "Gemini represents one of the strongest AI model lineups globally, and YouTube's ad inventory remains the most efficient video platform available. "
            "The stock trades at roughly 25x earnings — a meaningful discount to MSFT and AMZN despite comparable competitive advantages and superior AI research depth."
        ),
        'sector_role': "Growth anchor in Technology — blends search defensibility with cloud and AI acceleration at the lowest multiple in large-cap tech.",
        'peers': [
            {'ticker': 'META', 'note': "→ Meta's social advertising is recovering strongly and AI integration is rapid, but GOOGL's search moat and GCP provide more durable earnings in a downturn."},
            {'ticker': 'MSFT', 'note': "→ MSFT's enterprise distribution is superior; GOOGL's consumer reach and search dominance make them complementary rather than interchangeable holdings."},
            {'ticker': 'AMZN', 'note': "→ AWS leads cloud; GOOGL's search ad dominance and GCP growth make the two largely additive AI exposures rather than competing choices."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'META',  'text': "GOOGL's search monopoly and cloud trajectory provide more earnings visibility than Meta's advertising-only revenue concentration."},
            {'type': 'consider', 'ticker': 'MSFT',  'text': "Pair GOOGL with MSFT — search/advertising vs. enterprise/productivity creates genuine diversification within large-cap tech at different valuations."},
            {'type': 'consider', 'ticker': 'AMZN',  'text': "AMZN's AWS leadership and advertising growth are compelling alongside GOOGL as complementary cloud-era compounders."},
        ],
    },
    'META': {
        'headline': "Ad revenue recovery, AI efficiency, and 3B users make Meta the highest-ROIC business in big tech.",
        'why_this_stock': (
            "Meta's advertising revenue has re-accelerated sharply as iOS signal loss headwinds dissipated and AI-driven ad targeting improved conversion rates for advertisers. "
            "The Year of Efficiency restructuring permanently improved operating margins from ~25% to ~40%, transforming the earnings profile in a lasting way. "
            "Threads, WhatsApp monetisation, and Reels are still early in their monetisation curves, providing multiple growth levers beyond core Facebook ad spend. "
            "Reality Labs losses are declining as hardware ambitions are recalibrated toward AI glasses, which show genuine early-stage demand signals."
        ),
        'sector_role': "High-conviction growth position — social media's network effect combined with accelerating AI-driven ad efficiency.",
        'peers': [
            {'ticker': 'GOOGL', 'note': "→ Google's search moat is more defensible long-term; META's social advertising recovery and margin structure are faster and stronger in the near term."},
            {'ticker': 'AMZN',  'note': "→ Amazon's advertising is growing faster from a smaller base, but META's scale of social data makes its ad targeting structurally superior."},
            {'ticker': 'NFLX',  'note': "→ Netflix's ad tier is growing but from a tiny base; META's advertising infrastructure is mature, dominant, and globally scaled by comparison."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'NFLX',  'text': "META's ad business scale and AI targeting advantage are structurally more durable than Netflix's nascent advertising tier at this stage."},
            {'type': 'prefer', 'ticker': 'AMZN',  'text': "META's margin profile and per-user monetisation of social data provide a more direct earnings thesis than Amazon's multi-segment complexity."},
            {'type': 'consider', 'ticker': 'GOOGL', 'text': "Consider pairing META and GOOGL for complementary ad market exposure — social vs. search serves different parts of the advertising funnel."},
        ],
    },
    'AMZN': {
        'headline': "AWS margin expansion and advertising acceleration are rewriting Amazon's earnings quality story.",
        'why_this_stock': (
            "AWS is growing 17%+ annually and approaching $100B in revenue with 30%+ operating margins, representing by far the highest-value business segment. "
            "The advertising business has crossed $50B annually and is growing faster than Google or Meta's core products from a structurally advantaged position inside the purchase funnel. "
            "Retail profitability is recovering as logistics overcapacity is absorbed and same-day delivery density improves unit economics significantly. "
            "The multiple of roughly 40x earnings reflects early-stage AI and logistics infrastructure optionality not yet visible in the run-rate numbers."
        ),
        'sector_role': "Cloud and commerce anchor — AWS cloud exposure, advertising growth, and logistics network effects in a single holding.",
        'peers': [
            {'ticker': 'MSFT', 'note': "→ Azure is gaining cloud market share; AMZN's AWS leads on absolute scale and depth of services, making it the stronger infrastructure-layer bet."},
            {'ticker': 'GOOGL', 'note': "→ GCP is gaining enterprise traction; AMZN's AWS ecosystem depth and developer mindshare are durable advantages that will be hard to displace."},
            {'ticker': 'WMT',  'note': "→ Walmart's advertising and e-commerce are growing, but Amazon's AWS earnings quality makes the two very different risk/reward profiles."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'WMT',   'text': "AMZN's AWS profitability and advertising growth provide superior earnings compounding to Walmart's thin-margin retail-dominant model."},
            {'type': 'consider', 'ticker': 'MSFT',  'text': "AWS's service depth makes AMZN the preferred cloud infrastructure play; consider MSFT alongside for enterprise software exposure."},
            {'type': 'consider', 'ticker': 'GOOGL', 'text': "GCP's momentum is real — pair GOOGL alongside AMZN if maximum cloud diversification is desired, as both are gaining AWS share."},
        ],
    },
    'AVGO': {
        'headline': "Custom AI silicon and networking dominance make Broadcom the highest-quality pick in AI infrastructure.",
        'why_this_stock': (
            "Broadcom's custom AI accelerator chips for Google and Meta represent a multi-year design win cycle that is largely locked in and not subject to NVIDIA's pricing power. "
            "The VMware acquisition has transformed the company into a software-heavy business with 60%+ gross margins and growing recurring subscription revenue. "
            "Networking semiconductors for AI data centers — where Broadcom holds 70%+ market share in key segments — provide earnings visibility rivalling NVDA's. "
            "The dividend yield of 1.5%+ is unusual for a high-growth semiconductor company and provides meaningful downside support."
        ),
        'sector_role': "AI infrastructure via custom silicon and networking — lower single-stock risk than NVDA with comparable AI capex cycle leverage.",
        'peers': [
            {'ticker': 'NVDA', 'note': "→ NVDA's AI GPU dominance is wider; AVGO's custom chip franchise and networking position are more defensible against future GPU commoditisation."},
            {'ticker': 'QCOM', 'note': "→ Qualcomm has stronger mobile and auto diversification; AVGO's AI data center exposure is more concentrated and faster-growing right now."},
            {'ticker': 'AMD',  'note': "→ AMD competes on GPU; AVGO's custom ASIC approach creates unique customer relationships that AMD's off-the-shelf GPU model does not offer."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'QCOM', 'text': "AVGO's AI data center growth is more directly tied to the current capex cycle; Qualcomm's mobile recovery is slower and more cyclical."},
            {'type': 'prefer', 'ticker': 'AMD',  'text': "AVGO's VMware software transformation and custom silicon moat provide more durable margin defensibility than AMD's GPU market share strategy."},
            {'type': 'consider', 'ticker': 'NVDA', 'text': "NVDA offers higher upside in a winner-take-all AI GPU scenario; AVGO is better as a lower-risk complement rather than substitute."},
        ],
    },
    'AMD': {
        'headline': "Data center GPU momentum and MI300 adoption position AMD as the credible challenger to NVIDIA's AI dominance.",
        'why_this_stock': (
            "AMD's MI300X GPU is gaining real design wins at Microsoft, Meta, and government AI programs — not just aspirational pipeline, but revenue now flowing. "
            "The data center segment is growing 80%+ annually from a low base, creating a multi-year runway before it runs into the NVDA wall of ecosystem lock-in. "
            "At a lower multiple than NVDA, AMD prices in a scenario where it captures a minority share of AI accelerator spend — which is still a large and growing number. "
            "Client and gaming recovery provides near-term earnings support while the data center thesis matures into a more dominant revenue contributor."
        ),
        'sector_role': "Technology growth position — AI infrastructure exposure at a lower valuation than NVDA, with optionality on CUDA alternative adoption.",
        'peers': [
            {'ticker': 'NVDA', 'note': "→ NVDA's CUDA ecosystem moat is substantial; AMD's MI300 wins demonstrate real enterprise appetite for an alternative when pricing power becomes excessive."},
            {'ticker': 'INTC', 'note': "→ Intel's Gaudi AI accelerator has not gained meaningful traction; AMD's execution track record under Lisa Su is far superior for investor confidence."},
            {'ticker': 'AVGO', 'note': "→ Broadcom's custom ASIC approach serves specific hyperscalers; AMD's GPU serves the general-purpose AI training market at broader addressability."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'INTC', 'text': "AMD's consistent execution and data center momentum make it structurally superior to Intel's multi-year turnaround story with uncertain outcomes."},
            {'type': 'consider', 'ticker': 'NVDA', 'text': "NVDA's ecosystem moat is real — AMD is the higher-risk, lower-multiple alternative; both can be held for diversified AI hardware exposure."},
            {'type': 'consider', 'ticker': 'AVGO', 'text': "AVGO's custom silicon and networking provide more stable AI revenue than AMD's GPU market share gains against NVDA's entrenched position."},
        ],
    },
    'LLY': {
        'headline': "The GLP-1 obesity and diabetes franchise gives Eli Lilly a multi-decade runway unlike anything else in pharma.",
        'why_this_stock': (
            "Tirzepatide (Mounjaro/Zepbound) is the best-in-class GLP-1 agent by efficacy and is gaining share against Novo's semaglutide faster than the market anticipated. "
            "The addressable market for obesity treatment is potentially the largest single drug market in history — over 1 billion people globally qualify for treatment. "
            "LLY's manufacturing capacity is being built out aggressively to meet demand that currently exceeds supply, creating a supply-gated upside scenario. "
            "The pipeline beyond GLP-1 includes Alzheimer's, renal, and cardiovascular indications providing additional long-term optionality."
        ),
        'sector_role': "Primary Healthcare growth driver — high-conviction compounder with a 5-10 year structural earnings ramp few pharma names can match.",
        'peers': [
            {'ticker': 'ABBV', 'note': "→ AbbVie has a stronger current dividend and trades cheaper on earnings; LLY's GLP-1 growth trajectory is incomparably faster for the next 5 years."},
            {'ticker': 'JNJ',  'note': "→ JNJ offers more stability and a higher yield; LLY is the higher-growth, higher-multiple option for investors with a longer time horizon."},
            {'ticker': 'UNH',  'note': "→ UnitedHealth is the managed care compounder; LLY is the biotech growth story — genuinely complementary healthcare exposures with different drivers."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'ABBV', 'text': "LLY's GLP-1 franchise is a category-defining opportunity; AbbVie's Humira replacement story is solid but materially smaller in magnitude."},
            {'type': 'prefer', 'ticker': 'JNJ',  'text': "LLY's earnings growth rate justifies the premium multiple; JNJ's stability comes at the cost of a far slower compounding trajectory."},
            {'type': 'consider', 'ticker': 'UNH', 'text': "UNH is worth owning alongside LLY for managed care exposure — the two are genuinely complementary with different fundamental drivers."},
        ],
    },
    'UNH': {
        'headline': "Optum's vertical integration is quietly turning UnitedHealth into the most durable healthcare compounder.",
        'why_this_stock': (
            "UnitedHealth's integration of insurance (UnitedHealthcare) and healthcare services (Optum) creates competitive advantages that pure insurers and pure providers cannot replicate. "
            "Optum Health's value-based care model directly reduces medical costs while improving clinical outcomes, expanding margins in a virtuous cycle. "
            "The company has compounded earnings at 14%+ annually for a decade, outperforming the broader market through multiple macro environments. "
            "At roughly 22x earnings, UNH trades at a deserved premium to peers given the quality and visibility of its earnings stream."
        ),
        'sector_role': "Healthcare anchor — stable compounder with defensive earnings that hold up through market cycles, unlike growth-only pharma.",
        'peers': [
            {'ticker': 'ABBV', 'note': "→ AbbVie is a pharma/biotech play; UNH is managed care — different portfolio roles and shouldn't be considered direct alternatives."},
            {'ticker': 'TMO',  'note': "→ Thermo Fisher is a life-sciences tools business with different growth drivers; UNH's managed care moat is a distinct portfolio exposure."},
            {'ticker': 'LLY',  'note': "→ LLY offers higher growth at a higher multiple; UNH's earnings are more predictable and the valuation more defensible in a risk-off environment."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'ABBV', 'text': "UNH's Optum vertical integration creates a structural cost advantage that pharma/biotech models like AbbVie's cannot replicate over a full cycle."},
            {'type': 'prefer', 'ticker': 'TMO',  'text': "UNH's managed care scale and Optum integration provide more consistent earnings compounding than Thermo Fisher's equipment cycle exposure."},
            {'type': 'consider', 'ticker': 'LLY',  'text': "LLY offers higher growth upside from GLP-1; pair both for balanced healthcare — growth via LLY, stability via UNH."},
        ],
    },
    'JNJ': {
        'headline': "Johnson & Johnson's pharma-focused transformation anchors the Healthcare sleeve with durable earnings quality.",
        'why_this_stock': (
            "Following the Kenvue spin-off, JNJ is now a pure-play pharmaceuticals and medtech company with higher-margin revenue and less consumer product volatility. "
            "The oncology pipeline led by Darzalex and Erleada provides a multi-year earnings growth runway independent of the legacy consumer business. "
            "MedTech segment revenues are recovering post-pandemic as elective procedures normalise, providing a second growth engine. "
            "The 60-year dividend growth streak and AA credit rating make JNJ the defensive income cornerstone of any healthcare allocation."
        ),
        'sector_role': "Healthcare defensive anchor — pharma transformation story with best-in-class income reliability and medtech recovery optionality.",
        'peers': [
            {'ticker': 'ABBV', 'note': "→ AbbVie's higher dividend yield is attractive but depends on Humira replacement execution; JNJ's diversified pipeline is more balanced."},
            {'ticker': 'MRK',  'note': "→ Merck's Keytruda is growing faster; JNJ's medtech segment provides diversification beyond oncology that Merck's pharma focus lacks."},
            {'ticker': 'LLY',  'note': "→ LLY's GLP-1 growth is faster but the valuation is far more demanding; JNJ is the defensive choice for capital preservation within healthcare."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'LLY',  'text': "JNJ's lower multiple and 60-year dividend track record make it the better choice when healthcare stability is prioritised over growth premium."},
            {'type': 'prefer', 'ticker': 'ABBV', 'text': "JNJ's diversified pharma/medtech model reduces single-pipeline risk compared to AbbVie's heavy reliance on immunology franchise replacement."},
            {'type': 'consider', 'ticker': 'MRK',  'text': "Merck's Keytruda momentum and oncology depth make it worth pairing with JNJ for more balanced pharma exposure across different therapeutic areas."},
        ],
    },
    'ABBV': {
        'headline': "Humira replacement execution and an underappreciated neuroscience pipeline make AbbVie a dividend compounder.",
        'why_this_stock': (
            "AbbVie's biosimilar headwinds to Humira are now well-understood by the market — the stock already discounts the revenue erosion, making current earnings quality better than feared. "
            "Skyrizi and Rinvoq are growing 40%+ annually and are on track to exceed Humira's peak revenue by 2025-2026, making the replacement thesis increasingly de-risked. "
            "The neuroscience portfolio (Botox, Vraylar, Ubrelvy) provides a diversification engine outside immunology with distinct growth drivers. "
            "At 15x earnings and a 3.5% yield with 11 consecutive years of dividend increases, ABBV is the income investor's choice in large-cap pharma."
        ),
        'sector_role': "Healthcare income position — dividend growth compounder with transition risk largely priced in and recovery trajectory firming.",
        'peers': [
            {'ticker': 'JNJ',  'note': "→ JNJ's diversified pharma/medtech model has lower single-pipeline concentration risk; ABBV's higher yield and faster near-term growth offset this."},
            {'ticker': 'MRK',  'note': "→ Merck's Keytruda pipeline is stronger on growth; ABBV's current dividend yield and valuation make it more attractive for income-oriented allocation."},
            {'ticker': 'LLY',  'note': "→ LLY's GLP-1 opportunity dwarfs ABBV's on magnitude; ABBV is the defensive income compounder while LLY is the high-conviction growth story."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'LLY',  'text': "ABBV's yield and lower valuation are preferred for income mandates; LLY is the higher-conviction growth position for capital appreciation."},
            {'type': 'consider', 'ticker': 'JNJ',  'text': "JNJ's medtech diversification offers more resilience to pharma-pipeline risk; consider pairing both for a complete defensive healthcare sleeve."},
            {'type': 'consider', 'ticker': 'MRK',  'text': "Merck's Keytruda momentum is compelling alongside ABBV's income characteristics — complementary pharma positions with different growth drivers."},
        ],
    },
    'JPM': {
        'headline': "The best balance sheet in banking at a reasonable multiple, while rates stay structurally elevated.",
        'why_this_stock': (
            "JPMorgan has the best-in-class balance sheet among US money-center banks, with CET1 capital well above regulatory minimums. "
            "Net interest income remains structurally elevated even as rate cuts begin, supported by a diversified funding mix that peers cannot match. "
            "Provisions are declining from post-COVID peaks, improving underlying earnings quality rather than masking cyclical deterioration. "
            "The combination of consumer banking, investment banking, and wealth management provides revenue diversification that pure commercial banks lack."
        ),
        'sector_role': "Financial sector anchor — highest-quality money-center bank providing earnings stability through the rate cycle.",
        'peers': [
            {'ticker': 'BAC', 'note': "→ BofA offers higher yield but carries more rate sensitivity and less revenue diversification than JPM's balanced consumer/IB mix."},
            {'ticker': 'GS',  'note': "→ Goldman has stronger IB upside in bull markets but far more volatile earnings; JPM's consumer deposit base provides stability GS cannot replicate."},
            {'ticker': 'V',   'note': "→ Visa is the payment network compounder — higher growth, higher multiple, zero credit risk; a fundamentally different but equally strong financials choice."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'BAC', 'text': "JPM's revenue diversification across IB, consumer, and wealth reduces the rate sensitivity that BofA's deposit-heavy model structurally cannot avoid."},
            {'type': 'prefer', 'ticker': 'GS',  'text': "JPM's earnings stability through the credit cycle is superior; Goldman's IB upside comes with materially higher earnings volatility across cycles."},
            {'type': 'consider', 'ticker': 'V',   'text': "Visa's payment network moat offers superior long-term compounding with zero credit risk; consider substituting if quality over yield is the goal."},
        ],
    },
    'GS': {
        'headline': "M&A recovery and trading strength make Goldman Sachs the highest-conviction financials trade in risk-on markets.",
        'why_this_stock': (
            "Goldman's capital markets and M&A advisory franchise is the strongest globally, and deal volumes are recovering sharply after two years of suppressed activity. "
            "Trading revenues have been elevated as rate volatility creates recurring opportunities across fixed income and equities desks. "
            "Asset management is growing into a recurring fee business via Alternatives, reducing earnings volatility versus the pure trading history. "
            "The stock trades at a meaningful discount to its through-cycle earnings power, particularly as the IPO and sponsor-backed M&A market normalises."
        ),
        'sector_role': "High-beta financials — captures the capital markets recovery cycle with outsized upside in risk-on environments.",
        'peers': [
            {'ticker': 'JPM', 'note': "→ JPM is the more defensive choice with better earnings stability; GS offers higher IB cycle leverage for investors with higher risk tolerance."},
            {'ticker': 'BLK', 'note': "→ BlackRock is the asset management compounder; GS is the investment bank — both financials but with very different earnings drivers and volatility."},
            {'ticker': 'V',   'note': "→ Visa's payment network delivers more predictable compounding than GS's cyclical capital markets revenue — a different risk/reward entirely."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'JPM', 'text': "In a recovering deal environment, Goldman's trading and M&A fees outperform JPM's more stable consumer mix for higher risk-tolerant investors."},
            {'type': 'prefer', 'ticker': 'BLK', 'text': "GS's capital markets recovery is more directly tied to the current rate cycle; BlackRock's AUM compounding is slower but more predictable long-term."},
            {'type': 'consider', 'ticker': 'V',   'text': "Visa offers superior long-term compounding with no credit or cycle risk; consider substituting GS with V if earnings stability is prioritised."},
        ],
    },
    'V': {
        'headline': "Payment network effects and cross-border volume make Visa the most defensible compounder in financials.",
        'why_this_stock': (
            "Visa's network connects over 80 million merchants and 14,000+ financial institutions, creating a two-sided marketplace that becomes more valuable with every new participant. "
            "The business model — taking a small percentage of every transaction — has no credit risk, no balance sheet exposure, and scales directly with global GDP and consumer spending. "
            "Cross-border transaction volumes are recovering to pre-pandemic levels and growing beyond, providing the highest-margin revenue line in the business. "
            "Free cash flow conversion exceeds 95%, supporting buybacks that have reduced share count by roughly 20% over the past decade."
        ),
        'sector_role': "Premium financials compounder — zero credit risk, global network effects, and a capital-light model that scales with every tap and swipe.",
        'peers': [
            {'ticker': 'MA',  'note': "→ Mastercard is an essentially equal alternative — slightly faster services revenue growth vs Visa's slightly larger global network; both are outstanding long-term holds."},
            {'ticker': 'AXP', 'note': "→ AmEx targets premium cardholders with a spend-centric model; Visa's network approach provides broader coverage without concentration in any single consumer segment."},
            {'ticker': 'JPM', 'note': "→ JPM has credit risk and rate cycle exposure that Visa structurally avoids; the payment network model is superior from a risk-adjusted return perspective."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'JPM',  'text': "Visa's capital-light model and absence of credit risk make it a structurally superior long-term compounder versus any bank's balance sheet exposure."},
            {'type': 'prefer', 'ticker': 'AXP',  'text': "Visa's network scale and business model neutrality make it less cyclical than AmEx's premium spend concentration in economic downturns."},
            {'type': 'consider', 'ticker': 'MA',   'text': "Mastercard is an equally compelling alternative — holding both V and MA provides maximum payment network exposure with minimal duplication."},
        ],
    },
    'BAC': {
        'headline': "Rate-sensitive NII and consumer banking scale make BofA the high-leverage play on a stable credit environment.",
        'why_this_stock': (
            "Bank of America has the largest retail deposit base in the US, providing a low-cost funding advantage that amplifies net interest income when rates are elevated. "
            "Merrill Lynch and wealth management contribute recurring fee income that reduces earnings cyclicality versus pure commercial banking peers. "
            "Consumer credit quality has remained remarkably stable despite rate pressure, suggesting the loan portfolio is better positioned than feared. "
            "At roughly 12x earnings, BAC trades at a discount to JPM reflecting rate sensitivity — a premium that already appears substantially priced into the spread."
        ),
        'sector_role': "Consumer banking exposure — captures rate cycle upside with broad US consumer financial health as the underlying economic driver.",
        'peers': [
            {'ticker': 'JPM', 'note': "→ JPM is the higher-quality franchise with superior revenue diversification; BAC offers more rate leverage and slightly higher yield but with more earnings volatility."},
            {'ticker': 'GS',  'note': "→ Goldman has more capital markets leverage; BAC's consumer banking base provides more stable earnings than GS through a credit cycle downturn."},
            {'ticker': 'V',   'note': "→ Visa has no credit risk and compounds more reliably; BAC's yield and rate sensitivity offer a different return profile for income-oriented portfolios."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'GS',  'text': "BAC's consumer deposit scale provides more earnings stability than Goldman's capital markets-dependent revenue structure through a full cycle."},
            {'type': 'consider', 'ticker': 'JPM', 'text': "JPM's superior revenue diversification and franchise quality make it the preferred choice if only one bank position is available."},
            {'type': 'consider', 'ticker': 'V',   'text': "Visa's capital-light model is structurally superior long-term; consider V over BAC if credit cycle risk is a primary concern."},
        ],
    },
    'BLK': {
        'headline': "AUM scale and Aladdin's technology moat make BlackRock the most defensible asset manager in the industry.",
        'why_this_stock': (
            "BlackRock manages $10T+ in assets across active, passive, and alternatives, creating fee revenue that compounds with market returns and new client inflows simultaneously. "
            "Aladdin, the firm's risk management technology platform, serves 1,000+ institutions globally and creates a sticky B2B business that funds never replicate. "
            "The push into private markets and alternatives — now the fastest-growing and highest-fee segment — reduces dependence on low-margin passive index products. "
            "At roughly 23x earnings with a 2.5% dividend, BLK is the quality compounder of the financial sector for investors who want asset management without credit risk."
        ),
        'sector_role': "Financial sector quality anchor — pure-play asset management economics with technology moat and structural AUM tailwinds.",
        'peers': [
            {'ticker': 'GS',  'note': "→ Goldman has more capital markets leverage and IB cyclicality; BLK's AUM compounding is steadier and less dependent on deal flow environment."},
            {'ticker': 'V',   'note': "→ Visa compounds on transaction volumes; BLK compounds on assets — both are capital-light but serve fundamentally different roles in a portfolio."},
            {'ticker': 'JPM', 'note': "→ JPM's diversified banking provides more earnings drivers; BLK's pure asset management focus offers cleaner exposure to capital markets growth."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'GS',  'text': "BLK's AUM compounding and Aladdin technology revenue are more predictable than Goldman's deal-flow-dependent capital markets earnings."},
            {'type': 'consider', 'ticker': 'V',   'text': "V and BLK serve different roles — consider holding both as capital-light financials with payment network and asset management moats respectively."},
            {'type': 'consider', 'ticker': 'JPM', 'text': "JPM's banking diversification and deposit base are worth pairing with BLK for comprehensive financial sector exposure without overlap."},
        ],
    },
    'BND': {
        'headline': "Broad investment-grade ballast — the lowest-cost way to buffer equity volatility at this risk level.",
        'why_this_stock': (
            "BND tracks the Bloomberg US Aggregate Float Adjusted Index, capturing over 10,000 bonds across government, corporate, and mortgage-backed securities in a single holding. "
            "Its 0.03% expense ratio is the lowest available for this level of diversification, preserving every basis point of yield for the investor. "
            "Daily liquidity and deep market depth make it the frictionless choice for rebalancing without meaningful bid-ask drag. "
            "The blended duration of roughly 6.4 years provides meaningful rate sensitivity without the volatility of long-duration funds like TLT."
        ),
        'sector_role': "Portfolio ballast — historically negative correlation to equities during drawdowns, acting as automatic stabiliser when volatility spikes.",
        'peers': [
            {'ticker': 'AGG', 'note': "→ AGG tracks a near-identical index at the same expense ratio; BND's marginal coverage edge makes it the default, though both confirm core bond allocation."},
            {'ticker': 'LQD', 'note': "→ LQD concentrates in investment-grade corporates for higher yield but adds credit spread risk that BND avoids through government bond inclusion."},
            {'ticker': 'TLT', 'note': "→ TLT provides stronger equity hedging via long duration but carries far higher interest rate risk — held separately for specific recession hedging."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'LQD',  'text': "BND's government/corporate blend avoids credit spread widening that LQD experiences exactly when portfolio protection is most needed."},
            {'type': 'prefer', 'ticker': 'TLT',   'text': "BND's moderate duration reduces interest rate risk while still providing equity hedging — TLT's 16-year duration creates unnecessary volatility for a core bond position."},
            {'type': 'consider', 'ticker': 'AGG',  'text': "AGG is a near-identical product at the same cost; consolidate into one or hold both for comprehensive investment-grade coverage confirmation."},
        ],
    },
    'AGG': {
        'headline': "Core investment-grade exposure with minimal tracking error — the index-confirmation choice for the bond sleeve.",
        'why_this_stock': (
            "AGG tracks the Bloomberg US Aggregate Bond Index, the industry benchmark against which most bond funds are measured, providing pure core fixed-income exposure. "
            "Its 0.03% expense ratio matches BND and the holdings overlap substantially, making it a low-cost confirmation position rather than a standalone diversifier. "
            "Duration of roughly 6.3 years is marginally shorter than BND, providing slightly less interest rate sensitivity in a rising rate scenario. "
            "Holding AGG alongside BND in this portfolio ensures comprehensive coverage of the investment-grade bond universe at negligible combined cost."
        ),
        'sector_role': "Bond sleeve confirmation — held alongside BND to ensure comprehensive investment-grade coverage and reduce single-fund concentration.",
        'peers': [
            {'ticker': 'BND',  'note': "→ BND is essentially equivalent; holding both provides index overlap confirmation and slightly broader coverage than either held alone."},
            {'ticker': 'LQD',  'note': "→ LQD's corporate concentration offers higher yield; AGG's government blend provides better flight-to-quality characteristics in a risk-off scenario."},
            {'ticker': 'IEF',  'note': "→ IEF focuses on intermediate Treasuries for cleaner rate exposure; AGG's blended approach makes it more suitable as the primary core bond holding."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'LQD',   'text': "AGG's government bond inclusion provides flight-to-quality ballast that LQD's corporate-only focus cannot deliver in a market stress scenario."},
            {'type': 'prefer', 'ticker': 'IEF',    'text': "AGG's broader coverage across government, corporate, and MBS makes it more appropriate as a core bond holding versus IEF's Treasury-only focus."},
            {'type': 'consider', 'ticker': 'BND',   'text': "BND is a nearly identical product — consider consolidating the bond sleeve into BND alone if simplifying the allocation is preferred."},
        ],
    },
    'TLT': {
        'headline': "Long-duration Treasury hedge — TLT delivers the strongest equity offset in a recession or rate-cut scenario.",
        'why_this_stock': (
            "TLT holds 20+ year Treasury bonds, giving it a roughly 16-year modified duration that produces significant gains when rates fall sharply — exactly the scenario that correlates with equity drawdowns. "
            "In the 2008 financial crisis, long Treasuries gained 25%+ as the S&P fell 50%, making TLT the most effective portfolio hedge available in a pure recession. "
            "At 4.4% yield, investors are compensated while waiting for the rate-cutting cycle that would drive capital appreciation on top of current income. "
            "The primary risk is inflation persistence — if rates stay higher for longer, TLT underperforms shorter-duration bonds, which makes position sizing critical."
        ),
        'sector_role': "Duration extension in the bond sleeve — provides the strongest recession hedge when equity correlations break down in a flight-to-quality event.",
        'peers': [
            {'ticker': 'BND',  'note': "→ BND's shorter duration is more balanced for everyday ballast; TLT is the specialist held for the specific scenario of a sharp rate cut or recession."},
            {'ticker': 'IEF',  'note': "→ IEF's intermediate duration (~7 years) offers a middle ground — less volatility than TLT but more rate sensitivity than BND for duration-aware portfolios."},
            {'ticker': 'HYG',  'note': "→ HYG moves with equities in a risk-off event, making it the wrong hedge; TLT's negative equity correlation is specifically what this position provides."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'HYG',  'text': "TLT's negative equity correlation in crisis scenarios is the primary rationale; HYG provides no such protection — the two serve opposite portfolio purposes."},
            {'type': 'prefer', 'ticker': 'IEF',  'text': "TLT's long duration provides a stronger recession hedge than IEF's intermediate duration — the incremental rate sensitivity is the point, not a drawback."},
            {'type': 'consider', 'ticker': 'BND', 'text': "If duration risk is a concern, increasing BND while reducing TLT shifts the duration profile down — a reasonable adjustment if rate uncertainty increases."},
        ],
    },
    'COST': {
        'headline': "Costco's membership model and $100B revenue base make it the most defensible retailer in any consumer environment.",
        'why_this_stock': (
            "Costco's membership renewal rate of 93%+ is the business metric that matters most — it means recurring, near-riskless revenue that funds the ability to sell merchandise at near-zero margin. "
            "The international expansion runway across Europe, China, and Japan is decades long, and each new warehouse ramp follows a highly repeatable and proven formula. "
            "The treasure-hunt merchandising and Kirkland private label create a shopping experience that e-commerce cannot replicate, protecting physical retail traffic effectively. "
            "Despite a 48x earnings multiple, COST has earned this premium through 30+ years of consistent execution and membership loyalty compounding."
        ),
        'sector_role': "Consumer staple compounder — defensive earnings quality with membership renewal visibility that persists through economic cycles.",
        'peers': [
            {'ticker': 'WMT',  'note': "→ Walmart's advertising and marketplace growth is faster at larger scale; COST's membership model provides higher earnings quality and less price war exposure."},
            {'ticker': 'HD',   'note': "→ Home Depot is a home-improvement play with different cyclicality; COST's everyday consumables base is more recession-resistant by nature."},
            {'ticker': 'AMZN', 'note': "→ Amazon competes on price and convenience online; COST's in-store treasure-hunt model and membership loyalty have proven remarkably resistant to e-commerce disruption."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'WMT',   'text': "COST's membership model provides more durable earnings quality than Walmart's thin-margin superstore operation despite both competing on value pricing."},
            {'type': 'prefer', 'ticker': 'AMZN',  'text': "COST's physical store economics and treasure-hunt experience are structurally resistant to Amazon's disruption — 93% renewal rates prove the loyalty sticks."},
            {'type': 'consider', 'ticker': 'HD',   'text': "Home Depot offers meaningful upside if housing turnover recovers; consider pairing COST and HD for complementary consumer sector exposure."},
        ],
    },
    'WMT': {
        'headline': "Walmart's advertising and marketplace revenues are transforming a retailer into a technology-enabled business.",
        'why_this_stock': (
            "Walmart Connect advertising is growing 28%+ annually, leveraging first-party retail purchase data that Google and Meta cannot match for intent-based targeting. "
            "The marketplace and Walmart+ subscription layer are adding high-margin revenue streams on top of the physical retail base, improving earnings mix quality. "
            "Sam's Club and international operations (especially Flipkart in India) provide diversification beyond US grocery that peers lack. "
            "The balance sheet is strong enough to acquire or build new capabilities without dilution, unlike smaller retailers facing identical competitive dynamics."
        ),
        'sector_role': "Defensive consumer anchor — physical retail scale with fast-growing digital revenue streams at a reasonable valuation relative to growth.",
        'peers': [
            {'ticker': 'COST', 'note': "→ Costco's membership model provides higher earnings quality; WMT's scale and digital transformation offer more upside from advertising monetisation."},
            {'ticker': 'AMZN', 'note': "→ Amazon's marketplace and advertising are larger; WMT's physical footprint gives it last-mile logistics advantages that Amazon is spending billions to replicate."},
            {'ticker': 'HD',   'note': "→ Home Depot is more cyclical (tied to housing); WMT's everyday consumables base provides more consistent defensive earnings through cycles."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'HD',   'text': "WMT's everyday consumables demand is more recession-resistant than Home Depot's discretionary home improvement exposure."},
            {'type': 'consider', 'ticker': 'COST', 'text': "COST's membership model offers superior earnings quality; consider COST if membership loyalty and margin stability outweigh WMT's digital monetisation story."},
            {'type': 'consider', 'ticker': 'AMZN', 'text': "Amazon's e-commerce and AWS may offer a more compelling total-return story; WMT is preferred for its defensive income characteristics."},
        ],
    },
    'HD': {
        'headline': "Housing turnover recovery and Pro contractor share gains position Home Depot for above-market earnings growth.",
        'why_this_stock': (
            "Home Depot is the dominant home improvement retailer with 50%+ US market share and a Pro customer base — contractors and builders — that generates higher transaction values and repeat business than consumer DIY. "
            "The SRS Distribution acquisition extends HD's reach into the specialty trades (roofing, pool, landscape) where fragmented local distributors have historically captured margin. "
            "The housing stock in the US is the oldest it has been in decades, and aging homes require maintenance regardless of whether owners are buying or selling — creating a non-cyclical demand floor. "
            "At roughly 25x earnings, HD's multiple is reasonable given the durable competitive advantages and the near-term housing turnover recovery tailwind."
        ),
        'sector_role': "Consumer sector growth position — housing-tied demand with defensive maintenance-driven floor and professional contractor network effects.",
        'peers': [
            {'ticker': 'COST', 'note': "→ Costco's everyday consumables are more recession-resistant; HD's home improvement exposure provides more cyclical upside when housing activity recovers."},
            {'ticker': 'WMT',  'note': "→ Walmart's everyday staples provide steadier demand; HD's Pro contractor penetration drives higher per-transaction value that WMT cannot replicate."},
            {'ticker': 'AMZN', 'note': "→ Amazon competes in home improvement online but HD's Pro network, in-store services, and same-day availability create competitive barriers for heavy materials."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'WMT',   'text': "HD's Pro contractor franchise and SRS Distribution acquisition provide a differentiated growth path beyond what Walmart's staples model offers."},
            {'type': 'prefer', 'ticker': 'AMZN',  'text': "HD's in-store Pro services and bulk materials logistics are structurally difficult for Amazon to replicate in home improvement."},
            {'type': 'consider', 'ticker': 'COST', 'text': "COST is the more defensive consumer position; consider pairing both for exposure to different consumer spending categories."},
        ],
    },
    'XOM': {
        'headline': "Pioneer acquisition improves Permian scale while the dividend yield provides a floor for patient energy investors.",
        'why_this_stock': (
            "ExxonMobil's Pioneer Natural Resources acquisition adds 1M+ barrels/day of low-cost Permian production, significantly improving the break-even cost structure of the combined company. "
            "The dividend has been maintained and grown through multiple oil price cycles, providing income stability that most energy investors undervalue. "
            "The integrated model — upstream, refining, chemicals — creates natural hedges that pure E&P players cannot replicate when margins shift between segments. "
            "At roughly 12x earnings and a 3.5% yield, XOM is not priced for optimism despite substantial structural improvements in the asset quality."
        ),
        'sector_role': "Energy sector anchor — integrated model and Permian scale provide earnings stability across commodity price cycles.",
        'peers': [
            {'ticker': 'CVX', 'note': "→ Chevron's balance sheet is slightly stronger and the Hess deal extends deepwater runway; XOM's Permian integration is more operationally transformative."},
            {'ticker': 'COP', 'note': "→ ConocoPhillips has a more capital-disciplined variable dividend model; XOM's integrated refining adds complexity but also earnings diversification."},
            {'ticker': 'EOG', 'note': "→ EOG is the premium E&P with superior operational metrics; XOM's integrated scale provides more earnings stability but less operating leverage to oil prices."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'EOG',  'text': "XOM's integrated model and dividend track record make it more suitable as a core energy position versus EOG's pure-play exploration leverage."},
            {'type': 'consider', 'ticker': 'CVX', 'text': "Chevron's balance sheet strength and Hess acquisition make it a near-equal alternative; consider holding both for full-cycle integrated energy exposure."},
            {'type': 'consider', 'ticker': 'COP', 'text': "ConocoPhillips' variable dividend and low-cost assets are worth pairing with XOM for complementary integrated plus pure-play upstream exposure."},
        ],
    },
    'CVX': {
        'headline': "Balance sheet strength and Hess deepwater exposure make Chevron the quality play in integrated energy.",
        'why_this_stock': (
            "Chevron's net debt position is the strongest among major integrated oil companies, providing flexibility to sustain the dividend through any realistic oil price scenario. "
            "The Hess acquisition adds high-return deepwater Guyana barrels at a reasonable price, extending the production growth runway meaningfully to 2030+. "
            "The Permian position is the third-largest in the basin with a multi-decade drilling inventory at sub-$40 per barrel break-even costs. "
            "At 4.1% yield with a 35+ year dividend growth streak, Chevron is the income investor's preferred choice in the energy sector."
        ),
        'sector_role': "Energy sector quality anchor — balance sheet discipline and dividend track record provide income with commodity cycle resilience.",
        'peers': [
            {'ticker': 'XOM',  'note': "→ Exxon's Permian integration through Pioneer is more operationally transformative; CVX's balance sheet and Guyana exposure make it the safer income choice."},
            {'ticker': 'COP',  'note': "→ ConocoPhillips' variable dividend and cost discipline are competitive; CVX's integrated model and fixed dividend offer more income predictability."},
            {'ticker': 'EOG',  'note': "→ EOG is the higher-quality pure E&P; CVX's refining and chemicals add diversification but dilute the direct oil price upside leverage."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'EOG',   'text': "CVX's integrated model and balance sheet fortress make it more appropriate as a core energy hold versus EOG's pure-play operational leverage."},
            {'type': 'consider', 'ticker': 'XOM',  'text': "XOM and CVX are equally compelling at current levels — holding both provides maximum integrated energy exposure if the budget allows."},
            {'type': 'consider', 'ticker': 'COP',  'text': "ConocoPhillips' capital discipline and variable dividend model are worth pairing with CVX for complementary upstream energy exposure."},
        ],
    },
    'VTI': {
        'headline': "Total US market exposure at minimum cost — VTI is the default core equity holding for any long-term portfolio.",
        'why_this_stock': (
            "VTI provides exposure to the entire US equity market — large, mid, and small cap — in a single ETF at 0.03% annual cost, making it the most efficient way to capture US equity returns. "
            "The small and mid-cap component (roughly 20% of the fund) provides return premium versus large-cap-only S&P 500 ETFs over sufficiently long holding periods. "
            "Dividend reinvestment and low 20% annual turnover result in high tax efficiency, particularly valuable for taxable accounts. "
            "As a Vanguard fund, it benefits from the cooperative ownership structure that structurally incentivises ongoing expense ratio minimisation over time."
        ),
        'sector_role': "US equity core — diversified market beta across all sectors and sizes as the portfolio's broad market foundation.",
        'peers': [
            {'ticker': 'QQQ',  'note': "→ QQQ concentrates in Nasdaq-100 growth stocks for higher short-term returns; VTI's full market coverage is more appropriate as a core rather than satellite position."},
            {'ticker': 'AAPL', 'note': "→ AAPL is VTI's largest single holding; owning both introduces some AI/tech concentration overlap — manageable but worth tracking as positions scale."},
            {'ticker': 'MSFT', 'note': "→ MSFT is the second-largest VTI holding; the broad fund dilutes single-stock concentration risk while maintaining Microsoft's compounding through index weighting."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'QQQ',   'text': "VTI's total market coverage provides better diversification than QQQ's tech-concentration — QQQ is better as a tactical satellite, VTI as the core position."},
            {'type': 'consider', 'ticker': 'QQQ',  'text': "Splitting allocation between QQQ and VTI for a deliberate growth tilt captures both diversification and Nasdaq momentum simultaneously."},
            {'type': 'consider', 'ticker': 'AAPL', 'text': "Replacing VTI with individual stocks reduces diversification — VTI is best maintained as the core unless single-stock selection conviction is very high."},
        ],
    },
    'QQQ': {
        'headline': "Nasdaq-100 concentration in secular winners — the highest-conviction way to own the AI and cloud megatrend.",
        'why_this_stock': (
            "QQQ holds the 100 largest non-financial Nasdaq companies, effectively concentrating in technology, consumer internet, and biotech — the sectors driving the current earnings cycle. "
            "The top 10 holdings account for roughly 50% of the index, meaning QQQ is a high-conviction bet on NVDA, MSFT, AAPL, AMZN, META, GOOGL and their peer group. "
            "Over the past 15 years, QQQ has outperformed VTI by roughly 4% annually as technology's share of S&P 500 earnings grew from 15% to 35%. "
            "The 0.20% expense ratio is low for a factor-tilted ETF and the liquidity is unmatched among sector or thematic funds."
        ),
        'sector_role': "Technology and growth tilt — amplifies the portfolio's exposure to secular growth companies beyond their market-cap weight in a total market fund.",
        'peers': [
            {'ticker': 'VTI',  'note': "→ VTI is the more diversified option — QQQ's tech concentration is deliberate; use VTI when diversification matters more than growth tilt."},
            {'ticker': 'NVDA', 'note': "→ NVDA is QQQ's second-largest holding; owning both concentrates AI exposure — either own QQQ for broad tech or NVDA specifically for AI infrastructure."},
            {'ticker': 'MSFT', 'note': "→ MSFT is QQQ's largest holding at ~9%; owning both reduces the effective single-stock weight to manageable levels while maintaining compounding."},
        ],
        'verdicts': [
            {'type': 'prefer', 'ticker': 'VTI',   'text': "QQQ's tech concentration is intentional and justified when secular growth is the goal; VTI is preferred when full market diversification is the priority."},
            {'type': 'consider', 'ticker': 'VTI',  'text': "Splitting between QQQ and VTI for a growth tilt without full Nasdaq concentration is a reasonable core-satellite approach."},
            {'type': 'consider', 'ticker': 'NVDA', 'text': "NVDA offers more direct AI infrastructure exposure with less diversification; QQQ is the better choice if broad tech is preferred over any single stock."},
        ],
    },
}

def _classify_tier(ticker: str) -> str:
    if ticker in _BOND_ETFS:
        return 'bond'
    elif ticker in _GROWTH_TICKERS:
        return 'growth'
    elif ticker in _DIVERSIFIED_ETFS:
        return 'diversified'
    else:
        return 'stable'


def _compute_position_signal(weight: float, avg_weight: float) -> str:
    ratio = weight / avg_weight if avg_weight > 0 else 1.0
    if ratio >= 1.4:
        return 'overweight'
    elif ratio <= 0.6:
        return 'reduce'
    return 'hold'


def _generate_allocation_logic(ticker: str, weight_pct: float, avg_pct: float, risk_level: str, signal: str, tier: str) -> str:
    w = f"{weight_pct:.1f}%"
    risk_noun = {'conservative': 'capital-preservation', 'aggressive': 'growth-maximising'}.get(risk_level.lower(), 'balanced')
    tier_label = {'growth': 'high-growth', 'bond': 'fixed-income', 'income': 'dividend', 'diversified': 'broad-market'}.get(tier, 'quality')
    if signal == 'overweight':
        return (
            f"At {w}, this is an above-average position for a {risk_level} profile, reflecting the risk-level multiplier applied to {tier_label} assets. "
            f"The overweight signals higher conviction in this holding's contribution to the target return profile relative to average. "
            f"In a {risk_level} allocation, {tier_label} assets receive enhanced weighting when they align with the primary investment mandate. "
            "Position sizing is reviewed continuously — the weight would be scaled back if concentration limits or the underlying thesis changes materially."
        )
    elif signal == 'reduce':
        return (
            f"At {w}, this position is sized conservatively below the portfolio average, reflecting the risk-level discount applied to this asset class in a {risk_noun} profile. "
            f"A {risk_level} allocation intentionally underweights certain categories to maintain the target risk-return balance across the full portfolio. "
            "The smaller allocation still provides meaningful exposure to this sector without concentrating in a single name beyond the mandate. "
            "The position could be increased if the risk profile shifts toward higher conviction or the risk level is updated upward."
        )
    return (
        f"At {w}, this position is sized in line with the portfolio average, reflecting a balanced conviction level for a {risk_level} investor. "
        "Equal-weight sizing across hold-rated positions ensures no single stock drives the portfolio's outcome disproportionately. "
        "This allocation contributes to sector diversification without making a high-conviction directional bet on any single thesis. "
        "Sizing would be revised upward if the fundamental case strengthens or the risk profile is moved to a higher tier."
    )


def _generate_goal_alignment(ticker: str, user_goals: list, tier: str) -> str:
    goal_map = {
        'wealth': 'long-term wealth compounding',
        'retire': 'retirement security',
        'income': 'income generation',
        'house': 'capital preservation',
        'edu': 'medium-term capital growth',
    }
    goals_str = ', '.join([goal_map.get(g, g) for g in (user_goals or [])]) or 'balanced growth'
    tier_fits = {
        'growth':      f"Growth-oriented holdings like {ticker} directly serve the {goals_str} objective by providing above-market return potential over the investment horizon.",
        'bond':        f"Fixed-income positions like {ticker} reduce portfolio volatility and provide stable income — essential for {goals_str} across all market cycles.",
        'diversified': f"Broad-market exposure via {ticker} ensures the portfolio participates in overall equity growth, efficiently supporting the {goals_str} mandate.",
        'stable':      f"{ticker}'s earnings quality and competitive positioning align with {goals_str} by providing reliable compounding with manageable drawdown risk.",
    }
    return tier_fits.get(tier, f"This position supports the {goals_str} objective through sector diversification and risk-adjusted return contribution.")


def _build_fallback_analysis(ticker: str, sector: str, tier: str) -> dict:
    sector_names = {
        'tech': 'Technology', 'healthcare': 'Healthcare', 'finance': 'Financials',
        'energy': 'Energy', 'consumer': 'Consumer', 'bonds': 'Fixed Income',
        'real_estate': 'Real Estate', 'international': 'International', 'diversified': 'Diversified',
    }
    sd = sector_names.get(sector, sector.title())
    tier_headlines = {
        'growth':      f'High-growth {sd} holding — selected for secular upside in the current market cycle.',
        'bond':        f'Fixed-income stability — provides portfolio ballast and income generation in the bond sleeve.',
        'stable':      f'Quality {sd} compounder — selected for earnings reliability and competitive positioning.',
        'diversified': f'Diversified {sd} exposure — broad market participation with low single-stock risk.',
    }
    sector_default_peers = {
        'tech':        [('NVDA', 'MSFT'), ('MSFT', 'AAPL'), ('AAPL', 'GOOGL')],
        'healthcare':  [('LLY', 'UNH'), ('UNH', 'JNJ'), ('JNJ', 'ABBV')],
        'finance':     [('JPM', 'GS'), ('GS', 'V'), ('V', 'BAC')],
        'energy':      [('XOM', 'CVX'), ('CVX', 'COP'), ('COP', 'EOG')],
        'consumer':    [('COST', 'WMT'), ('WMT', 'HD'), ('HD', 'KO')],
        'bonds':       [('BND', 'AGG'), ('AGG', 'TLT'), ('TLT', 'LQD')],
        'diversified': [('VTI', 'QQQ'), ('QQQ', 'MSFT'), ('MSFT', 'AAPL')],
    }
    peer_pairs = [p for p in sector_default_peers.get(sector, [('VTI', 'QQQ'), ('MSFT', 'AAPL'), ('GOOGL', 'META')]) if p[0] != ticker][:3]
    peers = [{'ticker': p[0], 'note': f"→ Provides comparable {sd} sector exposure; relative weighting reflects portfolio's sector allocation targets."} for p in peer_pairs]
    verdicts = [
        {'type': 'prefer', 'ticker': peers[0]['ticker'] if peers else 'VTI',
         'text': f"{ticker} was selected based on the risk/return profile and sector diversification requirements of this portfolio."},
    ]
    return {
        'headline': tier_headlines.get(tier, f'{sd} holding selected for portfolio diversification and risk-adjusted returns.'),
        'why_this_stock': (
            f"{ticker} was selected for its position in the {sd} sector as part of a diversified portfolio construction strategy. "
            "The stock's characteristics align with the risk profile and investment goals provided during portfolio onboarding. "
            "Sector diversification across this portfolio reduces concentration risk and improves the overall risk-adjusted return profile. "
            "This position contributes to the target asset allocation for the specified risk level and time horizon."
        ),
        'sector_role': f'{sd} sector contribution — adds diversified exposure aligned with the portfolio\'s sector allocation targets.',
        'peers': peers if peers else [{'ticker': 'VTI', 'note': '→ Broad market alternative providing comparable diversified exposure.'}],
        'verdicts': verdicts,
    }


def get_stock_info(ticker: str) -> Dict[str, Any]:
    """Fetch current stock information for a given ticker."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="1y")

        current_price = info.get("currentPrice", 0)
        pe_ratio = info.get("trailingPE", None)
        market_cap = info.get("marketCap", 0)
        fifty_two_week_high = info.get("fiftyTwoWeekHigh", 0)
        fifty_two_week_low = info.get("fiftyTwoWeekLow", 0)

        year_return = None
        if len(hist) > 0:
            year_return = ((current_price - hist.iloc[0]["Close"]) / hist.iloc[0]["Close"]) * 100

        return {
            "ticker": ticker,
            "price": current_price,
            "pe_ratio": pe_ratio,
            "market_cap": market_cap,
            "52week_high": fifty_two_week_high,
            "52week_low": fifty_two_week_low,
            "year_return": year_return,
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Error fetching stock info for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


def screen_stocks(criteria: Dict[str, Any]) -> Dict[str, Any]:
    """
    Screen stocks based on AI-provided criteria. No external API calls.

    criteria: {
      'sector': 'tech' | 'healthcare' | 'finance' | 'energy' | 'consumer' | 'bonds'
               | 'real_estate' | 'international' | 'diversified',
      'market_cap': 'large' | 'mid' | 'small',
      'dividend_yield': 'high' | 'moderate' | 'growth',
      'user_goals': ['retire', 'wealth', 'income', 'house', 'edu']
    }
    """
    stock_universe = {
        'tech':          ['NVDA', 'META', 'GOOGL', 'AMZN', 'AMD', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'QCOM', 'TSLA', 'INTC', 'MSFT', 'AAPL'],
        'healthcare':    ['LLY', 'UNH', 'ABBV', 'TMO', 'ABT', 'MDT', 'AMGN', 'GILD', 'REGN', 'VRTX', 'BMY', 'CI', 'HUM', 'JNJ', 'MRK'],
        'finance':       ['BLK', 'GS', 'JPM', 'MS', 'AXP', 'COF', 'PGR', 'ICE', 'CME', 'SPGI', 'CB', 'TRV', 'PRU', 'BAC', 'SCHW'],
        'energy':        ['EOG', 'COP', 'HES', 'DVN', 'OXY', 'MPC', 'VLO', 'PSX', 'KMI', 'WMB', 'SLB', 'HAL', 'XOM', 'CVX', 'ET'],
        'consumer':      ['COST', 'HD', 'LOW', 'TGT', 'NKE', 'SBUX', 'YUM', 'DG', 'DLTR', 'MCD', 'PG', 'KO', 'PEP', 'CL', 'WMT'],
        'bonds':         ['BND', 'AGG', 'LQD', 'TLT', 'IEF', 'SHV', 'HYG', 'TIP', 'MUB', 'VCIT', 'VCSH', 'BSV'],
        'real_estate':   ['PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'VNQ', 'O', 'AVB', 'EXR', 'SPG'],
        'international': ['VXUS', 'EFA', 'VWO', 'IEFA', 'VEA', 'EEM', 'IEMG', 'DGS', 'SPDW', 'ACWX'],
        'diversified':   ['VTI', 'VOO', 'SPY', 'IVV', 'SCHB', 'VIG', 'DGRO', 'NOBL', 'DVY', 'QQQ'],
    }

    # Curated high-dividend sublists — no yfinance call needed for income/retire filtering
    high_dividend_universe = {
        'tech':          ['AAPL', 'MSFT', 'INTC', 'QCOM', 'AVGO'],
        'healthcare':    ['JNJ', 'ABT', 'MDT', 'ABBV', 'BMY', 'AMGN', 'GILD'],
        'finance':       ['JPM', 'BAC', 'PRU', 'TRV', 'CB', 'MS', 'AXP'],
        'energy':        ['XOM', 'CVX', 'COP', 'KMI', 'WMB', 'ET', 'OXY'],
        'consumer':      ['KO', 'PEP', 'PG', 'WMT', 'MCD', 'CL', 'YUM'],
        'bonds':         ['BND', 'AGG', 'LQD', 'TLT', 'IEF', 'HYG', 'TIP'],
        'real_estate':   ['O', 'VNQ', 'AVB', 'PSA', 'SPG', 'EXR', 'AMT'],
        'international': ['DGS', 'SPDW', 'IEFA', 'EFA', 'ACWX'],
        'diversified':   ['VIG', 'DGRO', 'NOBL', 'DVY', 'SCHB'],
    }

    sector = criteria.get('sector', 'diversified').lower()
    dividend_pref = criteria.get('dividend_yield', 'moderate').lower()
    user_goals = criteria.get('user_goals', [])

    need_dividend_filter = ('income' in user_goals or 'retire' in user_goals) and dividend_pref == 'high'

    if need_dividend_filter:
        candidates = list(high_dividend_universe.get(sector, high_dividend_universe['diversified']))
    else:
        candidates = list(stock_universe.get(sector, stock_universe['diversified']))

    random.shuffle(candidates)
    result_stocks = candidates[:10]

    reasoning = f"Screened {sector.title()} sector — selected {len(result_stocks)} securities for goals: {', '.join(user_goals) if user_goals else 'balanced growth'}"

    return {
        'stocks': result_stocks,
        'sector': sector,
        'reasoning': reasoning,
        'count': len(result_stocks),
    }


def compute_portfolio_weights(tickers: List[str], risk_level: str) -> Dict[str, float]:
    """
    Assign portfolio weights using risk-tier multipliers. No external API calls.

    Tickers are classified into growth / stable / income / diversified tiers.
    Multipliers amplify or dampen each tier based on the user's risk level,
    producing differentiated weights before the bond/equity split is applied.
    """
    MULTIPLIERS = {
        'conservative': {'growth': 0.6, 'stable': 1.1, 'income': 1.5, 'diversified': 1.2},
        'moderate':     {'growth': 1.0, 'stable': 1.0, 'income': 1.0, 'diversified': 1.0},
        'aggressive':   {'growth': 1.6, 'stable': 0.8, 'income': 0.4, 'diversified': 0.9},
    }
    mults = MULTIPLIERS.get(risk_level.lower(), MULTIPLIERS['moderate'])

    raw = {}
    for ticker in tickers:
        if ticker in _BOND_ETFS:
            raw[ticker] = mults['income']
        elif ticker in _GROWTH_TICKERS:
            raw[ticker] = mults['growth']
        elif ticker in _DIVERSIFIED_ETFS:
            raw[ticker] = mults['diversified']
        else:
            raw[ticker] = mults['stable']

    total = sum(raw.values()) or 1
    return {t: w / total for t, w in raw.items()}


def build_portfolio_recommendation(
    budget: float,
    risk_level: str,
    stocks: List[str] = None,
    user_goals: List[str] = None,
    time_horizon: int = 10
) -> Dict[str, Any]:
    """
    Build a portfolio recommendation using AI-selected stocks.

    Args:
        budget: Investment amount
        risk_level: 'conservative', 'moderate', 'aggressive'
        stocks: AI-selected tickers from screen_stocks
        user_goals: User's investment goals ['retire', 'wealth', 'income', 'house', 'edu']
        time_horizon: Years to invest
    """
    try:
        budget = float(budget)

        FALLBACK_BASKET = [
            'VTI', 'QQQ', 'BND', 'AAPL', 'MSFT', 'JNJ', 'JPM', 'XOM',
            'PG', 'UNH', 'NVDA', 'GOOGL', 'META', 'AMZN', 'LLY',
            'V', 'MA', 'COST', 'HD', 'AVGO',
        ]

        if not stocks or len(stocks) == 0:
            stocks = list(FALLBACK_BASKET)

        # Deduplicate while preserving order
        seen = set()
        unique_stocks = []
        for t in stocks:
            if t not in seen:
                seen.add(t)
                unique_stocks.append(t)
        stocks = unique_stocks

        # Pad to at least 10 stocks
        if len(stocks) < 10:
            for ticker in FALLBACK_BASKET:
                if ticker not in seen:
                    stocks.append(ticker)
                    seen.add(ticker)
                if len(stocks) >= 10:
                    break

        # Asset allocation targets by risk level
        allocations = {
            "conservative": {"bonds": 0.50, "dividend_stocks": 0.30, "growth_stocks": 0.20},
            "moderate":     {"bonds": 0.30, "dividend_stocks": 0.35, "growth_stocks": 0.35},
            "aggressive":   {"bonds": 0.10, "dividend_stocks": 0.30, "growth_stocks": 0.60},
        }
        allocation = allocations.get(risk_level.lower(), allocations["moderate"])

        if user_goals and 'income' in user_goals:
            allocation['dividend_stocks'] += 0.15
            allocation['growth_stocks'] -= 0.15

        if user_goals and 'retire' in user_goals and time_horizon > 20:
            allocation['bonds'] += 0.10
            allocation['growth_stocks'] -= 0.10

        total = sum(allocation.values())
        allocation = {k: v / total for k, v in allocation.items()}

        # Round-robin sector selection so no single sector dominates the first 15.
        # Group tickers by sector, then alternate 1-from-each until we have 15.
        sector_buckets = defaultdict(list)
        for t in stocks:
            sector_buckets[_TICKER_SECTOR.get(t, 'other')].append(t)

        active = [list(v) for v in sector_buckets.values()]
        selected = []
        while len(selected) < 15 and active:
            next_active = []
            for bucket in active:
                if len(selected) >= 15:
                    break
                if bucket:
                    selected.append(bucket.pop(0))
                if bucket:
                    next_active.append(bucket)
            active = next_active

        portfolio_tickers = selected

        # Rule-based weights — no external API calls
        weights = compute_portfolio_weights(portfolio_tickers, risk_level)

        # Enforce risk-level bond/equity split
        bond_tix   = [t for t in portfolio_tickers if t in _BOND_ETFS]
        equity_tix = [t for t in portfolio_tickers if t not in _BOND_ETFS]
        bond_target   = allocation['bonds']
        equity_target = 1.0 - bond_target

        if bond_tix and equity_tix:
            bond_raw   = sum(weights.get(t, 0) for t in bond_tix)   or 1
            equity_raw = sum(weights.get(t, 0) for t in equity_tix) or 1
            for t in bond_tix:
                weights[t] = (weights.get(t, 0) / bond_raw)   * bond_target
            for t in equity_tix:
                weights[t] = (weights.get(t, 0) / equity_raw) * equity_target
        elif not bond_tix:
            raw = sum(weights.get(t, 0) for t in equity_tix) or 1
            for t in equity_tix:
                weights[t] = weights.get(t, 0) / raw

        # Guarantee weights sum exactly to 1.0
        w_total = sum(weights.get(t, 0) for t in portfolio_tickers) or 1
        for t in portfolio_tickers:
            weights[t] = weights.get(t, 0) / w_total

        positions = {ticker: budget * weights[ticker] for ticker in portfolio_tickers}

        # ── Per-position editorial analysis ───────────────────────────────
        avg_weight = 1.0 / len(portfolio_tickers) if portfolio_tickers else 0.1
        position_details = []
        for ticker in portfolio_tickers:
            weight = weights[ticker]
            tier = _classify_tier(ticker)
            sector = _TICKER_SECTOR.get(ticker, 'diversified')
            signal = _compute_position_signal(weight, avg_weight)
            analysis = _TICKER_ANALYSIS.get(ticker) or _build_fallback_analysis(ticker, sector, tier)
            position_details.append({
                'ticker': ticker,
                'signal': signal,
                'headline': analysis['headline'],
                'why_this_stock': analysis['why_this_stock'],
                'allocation_logic': _generate_allocation_logic(ticker, weight * 100, avg_weight * 100, risk_level, signal, tier),
                'sector_role': analysis['sector_role'],
                'goal_alignment': _generate_goal_alignment(ticker, user_goals, tier),
                'peers': analysis['peers'],
                'verdicts': analysis['verdicts'],
            })

        reasoning = f"Built portfolio from {len(portfolio_tickers)} AI-selected stocks for {risk_level} risk, goals: {', '.join(user_goals or ['balanced'])}"

        return {
            "budget": budget,
            "risk_level": risk_level,
            "positions": positions,
            "position_details": position_details,
            "stocks": portfolio_tickers,
            "expected_return": 0,
            "volatility": 0,
            "sharpe_ratio": 0,
            "reasoning": reasoning,
            "goals": user_goals or [],
        }
    except Exception as e:
        logger.error(f"Error building portfolio recommendation: {e}")
        return {"error": str(e), "budget": budget}


def analyze_company(ticker: str) -> Dict[str, Any]:
    """Analyze a company's financial metrics and outlook."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            "ticker": ticker,
            "company_name": info.get("longName", "Unknown"),
            "price": info.get("currentPrice", 0),
            "pe_ratio": info.get("trailingPE", None),
            "debt_to_equity": info.get("debtToEquity", None),
            "roe": info.get("returnOnEquity", None),
            "roic": info.get("returnOnCapital", None),
            "dividend_yield": info.get("dividendYield", None),
            "revenue_growth": info.get("revenueGrowth", None),
            "earnings_growth": info.get("earningsGrowth", None),
            "sector": info.get("sector", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Error analyzing company {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


def get_sector_comparison(sector: str) -> Dict[str, Any]:
    """Compare stocks within a sector."""
    sector_stocks = {
        "Technology": ["AAPL", "MSFT", "NVDA", "GOOGL"],
        "Finance":    ["JPM", "BAC", "WFC", "GS"],
        "Healthcare": ["JNJ", "UNH", "PFE", "MRK"],
        "Energy":     ["XOM", "CVX", "COP", "EOG"],
        "Consumer":   ["AMZN", "WMT", "HD", "MCD"],
    }

    tickers = sector_stocks.get(sector, [])
    stocks = [get_stock_info(t) for t in tickers]
    return {"sector": sector, "stocks": stocks}
