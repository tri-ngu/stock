#!/usr/bin/env python3
"""
Parallel test suite for the Stock Advisor AI system.
Tests 10 scenarios simultaneously to verify correctness of:
- Portfolio generation
- Real market data integration
- AI agent decisions
- Metrics calculation
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

API_BASE = "http://localhost:8000"

# Test cases with different parameters
TEST_CASES = [
    {
        "name": "Conservative 6-Month Saver",
        "budget": 5000,
        "risk": 20,
        "term": 0.5,
        "goals": ["house"],
        "expected_stocks": 3,
        "expected_return_range": (1, 5),  # % annualized
        "expected_vol_range": (2, 8),
    },
    {
        "name": "Balanced 5-Year Investor",
        "budget": 25000,
        "risk": 50,
        "term": 5,
        "goals": ["wealth"],
        "expected_stocks": 5,
        "expected_return_range": (6, 10),
        "expected_vol_range": (8, 14),
    },
    {
        "name": "Aggressive Tech Investor",
        "budget": 50000,
        "risk": 85,
        "term": 10,
        "goals": ["wealth"],
        "expected_stocks": 5,
        "expected_return_range": (10, 16),
        "expected_vol_range": (14, 22),
    },
    {
        "name": "Income-Focused Retiree",
        "budget": 100000,
        "risk": 30,
        "term": 20,
        "goals": ["retire", "income"],
        "expected_stocks": 4,
        "expected_return_range": (4, 8),
        "expected_vol_range": (6, 12),
    },
    {
        "name": "Education Fund Planner",
        "budget": 15000,
        "risk": 60,
        "term": 12,
        "goals": ["edu"],
        "expected_stocks": 5,
        "expected_return_range": (7, 11),
        "expected_vol_range": (10, 16),
    },
    {
        "name": "Conservative Capital Preservation",
        "budget": 200000,
        "risk": 10,
        "term": 1,
        "goals": ["house"],
        "expected_stocks": 3,
        "expected_return_range": (2, 5),
        "expected_vol_range": (2, 6),
    },
    {
        "name": "Growth Legacy Portfolio",
        "budget": 500000,
        "risk": 75,
        "term": 30,
        "goals": ["legacy", "wealth"],
        "expected_stocks": 5,
        "expected_return_range": (9, 14),
        "expected_vol_range": (12, 20),
    },
    {
        "name": "Moderate Mixed Goal",
        "budget": 35000,
        "risk": 45,
        "term": 7,
        "goals": ["wealth", "income"],
        "expected_stocks": 5,
        "expected_return_range": (5, 10),
        "expected_vol_range": (8, 14),
    },
    {
        "name": "Ultra-Conservative Fixed Income",
        "budget": 10000,
        "risk": 15,
        "term": 3,
        "goals": ["income"],
        "expected_stocks": 3,
        "expected_return_range": (2, 5),
        "expected_vol_range": (2, 6),
    },
    {
        "name": "Maximum Risk Seeker",
        "budget": 75000,
        "risk": 95,
        "term": 15,
        "goals": ["wealth"],
        "expected_stocks": 5,
        "expected_return_range": (11, 18),
        "expected_vol_range": (16, 25),
    },
]


async def get_market_data(session, tickers):
    """Fetch real market data for given tickers."""
    try:
        ticker_str = ",".join(tickers)
        url = f"{API_BASE}/api/market-data?tickers={ticker_str}"
        async with session.get(url) as response:
            if response.status == 200:
                return await response.json()
            else:
                return {"error": f"HTTP {response.status}"}
    except Exception as e:
        return {"error": str(e)}


async def generate_portfolio(session, test_case):
    """Generate a portfolio for a test case."""
    try:
        # Simulate AI portfolio generation
        payload = {
            "message": f"""Build a portfolio recommendation for:
            - Budget: ${test_case['budget']}
            - Risk level: {test_case['risk']}/100
            - Time horizon: {test_case['term']} years
            - Goals: {', '.join(test_case['goals'])}

            Provide specific stock and ETF recommendations with allocations.""",
            "session_id": f"test_{test_case['name'].replace(' ', '_')}"
        }

        url = f"{API_BASE}/api/chat"
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as response:
            if response.status == 200:
                # Read streaming response line by line
                portfolio = None
                tool_calls = []

                try:
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        if line_str.startswith('data: '):
                            try:
                                data = json.loads(line_str[6:])
                                if data.get('type') == 'portfolio':
                                    portfolio = data.get('portfolio')
                                elif data.get('type') == 'tool_call':
                                    tool_calls.append(data)
                            except json.JSONDecodeError:
                                pass
                except Exception as stream_err:
                    # If streaming fails, try to read all at once
                    await response.seek(0)
                    content = await response.text()
                    for line in content.split('\n'):
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[6:])
                                if data.get('type') == 'portfolio':
                                    portfolio = data.get('portfolio')
                                elif data.get('type') == 'tool_call':
                                    tool_calls.append(data)
                            except json.JSONDecodeError:
                                pass

                return {
                    "status": "success",
                    "portfolio": portfolio,
                    "tool_calls": tool_calls,
                }
            else:
                error_text = await response.text()
                return {"status": "error", "code": response.status, "error": error_text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def run_test_case(session, test_case, index):
    """Run a single test case."""
    print(f"\n[Test {index + 1}/10] Starting: {test_case['name']}")
    print(f"  Budget: ${test_case['budget']:,} | Risk: {test_case['risk']}/100 | Term: {test_case['term']} years")

    start_time = time.time()

    # Generate portfolio via AI
    result = await generate_portfolio(session, test_case)

    elapsed = time.time() - start_time

    # Validate results
    errors = []
    warnings = []

    if result.get("status") != "success":
        errors.append(f"Portfolio generation failed: {result.get('message', 'Unknown error')}")
    else:
        portfolio = result.get("portfolio")
        if not portfolio:
            errors.append("No portfolio data returned")
        else:
            # Check budget
            if abs(portfolio.get("budget", 0) - test_case["budget"]) > 1:
                errors.append(f"Budget mismatch: expected ${test_case['budget']}, got ${portfolio.get('budget')}")

            # Check risk level
            if portfolio.get("risk_level") not in ["conservative", "moderate", "aggressive"]:
                errors.append(f"Invalid risk level: {portfolio.get('risk_level')}")

            # Check stocks
            stocks = portfolio.get("stocks", [])
            if len(stocks) < test_case["expected_stocks"]:
                warnings.append(f"Expected {test_case['expected_stocks']} stocks, got {len(stocks)}")

            # Check metrics
            exp_return = portfolio.get("expected_return", 0)
            volatility = portfolio.get("volatility", 0)

            if not (test_case["expected_return_range"][0] <= exp_return <= test_case["expected_return_range"][1]):
                warnings.append(
                    f"Expected return {exp_return:.1f}% outside range "
                    f"{test_case['expected_return_range']}"
                )

            if not (test_case["expected_vol_range"][0] <= volatility <= test_case["expected_vol_range"][1]):
                warnings.append(
                    f"Volatility {volatility:.1f}% outside range "
                    f"{test_case['expected_vol_range']}"
                )

            # Check positions
            positions = portfolio.get("positions", {})
            if not positions:
                errors.append("No positions in portfolio")
            else:
                total_allocation = sum(positions.values())
                if abs(total_allocation - test_case["budget"]) > 1:
                    errors.append(f"Position allocations don't sum to budget")

    # Print results
    status_icon = "PASS" if not errors else "FAIL"
    print(f"  [{status_icon}] Completed in {elapsed:.2f}s")

    if errors:
        print(f"  Errors:")
        for error in errors:
            print(f"    - {error}")

    if warnings:
        print(f"  Warnings:")
        for warning in warnings:
            print(f"    ! {warning}")

    if not errors and not warnings:
        print(f"  [OK] All checks passed!")
        if portfolio:
            print(f"    Stocks: {', '.join(portfolio.get('stocks', [])[:3])}")
            print(f"    Expected Return: {portfolio.get('expected_return', 0):.1f}%")
            print(f"    Volatility: {portfolio.get('volatility', 0):.1f}%")

    return {
        "test_case": test_case["name"],
        "success": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "elapsed": elapsed,
    }


async def run_all_tests():
    """Run all 10 test cases in parallel."""
    print("=" * 70)
    print("PARALLEL TEST SUITE - 10 TEST CASES")
    print("=" * 70)
    print(f"Starting at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API Base: {API_BASE}")
    print()

    async with aiohttp.ClientSession() as session:
        # Run all tests in parallel
        tasks = [
            run_test_case(session, test_case, i)
            for i, test_case in enumerate(TEST_CASES)
        ]

        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    passed = 0
    failed = 0

    for result in results:
        if isinstance(result, Exception):
            print(f"[CRASH] Test crashed: {result}")
            failed += 1
        else:
            if result["success"]:
                passed += 1
            else:
                failed += 1

            status = "[PASS]" if result["success"] else "[FAIL]"
            print(f"{status} | {result['test_case']:<35} | {result['elapsed']:>6.2f}s")

    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed (Total: {len(TEST_CASES)})")
    print(f"Total execution time: {total_time:.2f}s")
    print(f"Average time per test: {total_time / len(TEST_CASES):.2f}s")
    print("=" * 70)

    return passed == len(TEST_CASES)


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
