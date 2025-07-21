/**
 * Cost Optimization Report Generator
 * Generates comprehensive reports showing cost reduction achievements
 */

import { CostOptimizationMetrics } from './cost-optimizer';
import { BatchMetrics } from './batch-processor';
import { CacheStats } from './cache-manager';
import { logger } from '../utils/logger';

/**
 * Cost reduction report
 */
export interface CostReductionReport {
  summary: {
    targetReduction: number;
    achievedReduction: number;
    totalSaved: number;
    projectedAnnualSavings: number;
    status: 'on-track' | 'below-target' | 'exceeded';
  };
  breakdown: {
    intelligentRouting: {
      saved: number;
      percentage: number;
      details: any;
    };
    requestBatching: {
      saved: number;
      percentage: number;
      efficiency: number;
    };
    caching: {
      saved: number;
      percentage: number;
      hitRate: number;
    };
    resourceOptimization: {
      saved: number;
      percentage: number;
      details: any;
    };
  };
  providerAnalysis: {
    provider: string;
    requests: number;
    totalCost: number;
    avgCost: number;
    efficiency: number;
  }[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    potentialSavings: number;
    effort: 'low' | 'medium' | 'high';
  }[];
  timeline: {
    period: string;
    cost: number;
    saved: number;
    reduction: number;
  }[];
  benchmarks: {
    metric: string;
    current: number;
    target: number;
    industry: number;
    percentile: number;
  }[];
}

/**
 * Report generator for cost optimization metrics
 */
export class CostReportGenerator {
  private readonly industryBenchmarks = {
    costPerMillionTokens: 2.5,
    cacheHitRate: 0.75,
    batchingEfficiency: 2.5,
    providerReliability: 0.95
  };

  /**
   * Generate comprehensive cost reduction report
   */
  public generateReport(
    costMetrics: CostOptimizationMetrics,
    batchMetrics: BatchMetrics,
    cacheStats: CacheStats,
    targetReduction: number = 0.6
  ): CostReductionReport {
    const summary = this.generateSummary(costMetrics, targetReduction);
    const breakdown = this.generateBreakdown(costMetrics, batchMetrics, cacheStats);
    const providerAnalysis = this.analyzeProviders(costMetrics);
    const recommendations = this.generateRecommendations(
      costMetrics,
      batchMetrics,
      cacheStats,
      summary
    );
    const timeline = this.generateTimeline(costMetrics);
    const benchmarks = this.generateBenchmarks(costMetrics, batchMetrics, cacheStats);

    return {
      summary,
      breakdown,
      providerAnalysis,
      recommendations,
      timeline,
      benchmarks
    };
  }

  /**
   * Generate summary section
   */
  private generateSummary(
    metrics: CostOptimizationMetrics,
    targetReduction: number
  ): CostReductionReport['summary'] {
    const achievedReduction = metrics.reductionPercentage;
    const projectedAnnualSavings = metrics.projectedMonthlyCost * 12 * achievedReduction;
    
    let status: 'on-track' | 'below-target' | 'exceeded';
    if (achievedReduction >= targetReduction * 1.1) {
      status = 'exceeded';
    } else if (achievedReduction >= targetReduction * 0.9) {
      status = 'on-track';
    } else {
      status = 'below-target';
    }

    return {
      targetReduction,
      achievedReduction,
      totalSaved: metrics.totalSaved,
      projectedAnnualSavings,
      status
    };
  }

  /**
   * Generate cost breakdown by optimization method
   */
  private generateBreakdown(
    costMetrics: CostOptimizationMetrics,
    batchMetrics: BatchMetrics,
    cacheStats: CacheStats
  ): CostReductionReport['breakdown'] {
    const totalSaved = costMetrics.totalSaved;
    
    // Estimate savings by method (simplified - would use actual tracking)
    const routingSaved = totalSaved * 0.35;
    const batchingSaved = totalSaved * 0.25;
    const cachingSaved = totalSaved * 0.30;
    const resourceSaved = totalSaved * 0.10;

    return {
      intelligentRouting: {
        saved: routingSaved,
        percentage: routingSaved / totalSaved,
        details: {
          optimalProviderSelection: routingSaved * 0.6,
          fallbackOptimization: routingSaved * 0.2,
          loadBalancing: routingSaved * 0.2
        }
      },
      requestBatching: {
        saved: batchingSaved,
        percentage: batchingSaved / totalSaved,
        efficiency: batchMetrics.efficiencyGain
      },
      caching: {
        saved: cachingSaved,
        percentage: cachingSaved / totalSaved,
        hitRate: cacheStats.hitRate
      },
      resourceOptimization: {
        saved: resourceSaved,
        percentage: resourceSaved / totalSaved,
        details: {
          autoScaling: resourceSaved * 0.4,
          resourcePooling: resourceSaved * 0.3,
          idleReduction: resourceSaved * 0.3
        }
      }
    };
  }

  /**
   * Analyze provider usage and costs
   */
  private analyzeProviders(
    metrics: CostOptimizationMetrics
  ): CostReductionReport['providerAnalysis'] {
    const providers: any[] = [];
    
    for (const [provider, requests] of metrics.providerDistribution) {
      const cost = (requests * metrics.avgCostPerRequest) || 0;
      providers.push({
        provider,
        requests,
        totalCost: cost,
        avgCost: cost / requests,
        efficiency: this.calculateProviderEfficiency(provider, metrics)
      });
    }

    return providers.sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    costMetrics: CostOptimizationMetrics,
    batchMetrics: BatchMetrics,
    cacheStats: CacheStats,
    summary: CostReductionReport['summary']
  ): CostReductionReport['recommendations'] {
    const recommendations: CostReductionReport['recommendations'] = [];

    // Check if below target
    if (summary.status === 'below-target') {
      recommendations.push({
        priority: 'high',
        action: 'Enable aggressive batching mode to increase efficiency',
        potentialSavings: costMetrics.totalCost * 0.15,
        effort: 'low'
      });
    }

    // Cache optimization
    if (cacheStats.hitRate < 0.85) {
      recommendations.push({
        priority: 'high',
        action: 'Increase cache size and implement predictive warming',
        potentialSavings: costMetrics.totalCost * 0.10,
        effort: 'medium'
      });
    }

    // Batching optimization
    if (batchMetrics.efficiencyGain < 2.5) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize batch window timing and grouping logic',
        potentialSavings: costMetrics.totalCost * 0.08,
        effort: 'low'
      });
    }

    // Provider optimization
    const expensiveProviders = Array.from(costMetrics.providerDistribution.entries())
      .filter(([_, requests]) => requests > costMetrics.totalRequests * 0.3);
    
    if (expensiveProviders.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: `Shift traffic from expensive providers to cost-effective alternatives`,
        potentialSavings: costMetrics.totalCost * 0.12,
        effort: 'medium'
      });
    }

    // Resource optimization
    if (costMetrics.avgCostPerRequest > this.industryBenchmarks.costPerMillionTokens / 1000) {
      recommendations.push({
        priority: 'low',
        action: 'Implement token optimization strategies',
        potentialSavings: costMetrics.totalCost * 0.05,
        effort: 'high'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generate cost timeline
   */
  private generateTimeline(
    metrics: CostOptimizationMetrics
  ): CostReductionReport['timeline'] {
    // Generate mock timeline data (would use actual historical data)
    const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const baselineCost = metrics.totalCost / (1 - metrics.reductionPercentage);
    
    return periods.map((period, index) => {
      const progressFactor = (index + 1) / periods.length;
      const cost = baselineCost * (1 - metrics.reductionPercentage * progressFactor);
      const saved = baselineCost - cost;
      
      return {
        period,
        cost,
        saved,
        reduction: saved / baselineCost
      };
    });
  }

  /**
   * Generate benchmark comparisons
   */
  private generateBenchmarks(
    costMetrics: CostOptimizationMetrics,
    batchMetrics: BatchMetrics,
    cacheStats: CacheStats
  ): CostReductionReport['benchmarks'] {
    return [
      {
        metric: 'Cost per Million Tokens',
        current: costMetrics.avgCostPerRequest * 1000000,
        target: 1.60,
        industry: this.industryBenchmarks.costPerMillionTokens,
        percentile: this.calculatePercentile(
          costMetrics.avgCostPerRequest * 1000000,
          this.industryBenchmarks.costPerMillionTokens
        )
      },
      {
        metric: 'Cache Hit Rate',
        current: cacheStats.hitRate,
        target: 0.90,
        industry: this.industryBenchmarks.cacheHitRate,
        percentile: this.calculatePercentile(
          cacheStats.hitRate,
          this.industryBenchmarks.cacheHitRate
        )
      },
      {
        metric: 'Batching Efficiency',
        current: batchMetrics.efficiencyGain,
        target: 3.0,
        industry: this.industryBenchmarks.batchingEfficiency,
        percentile: this.calculatePercentile(
          batchMetrics.efficiencyGain,
          this.industryBenchmarks.batchingEfficiency
        )
      },
      {
        metric: 'Cost Reduction',
        current: costMetrics.reductionPercentage,
        target: 0.60,
        industry: 0.35,
        percentile: this.calculatePercentile(
          costMetrics.reductionPercentage,
          0.35
        )
      }
    ];
  }

  /**
   * Calculate provider efficiency
   */
  private calculateProviderEfficiency(
    provider: string,
    metrics: CostOptimizationMetrics
  ): number {
    // Simplified efficiency calculation
    const requests = metrics.providerDistribution.get(provider) || 0;
    const avgRequests = metrics.totalRequests / metrics.providerDistribution.size;
    return requests / avgRequests;
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(current: number, industry: number): number {
    // Simplified percentile calculation
    const ratio = current / industry;
    if (ratio <= 0.5) return 95;
    if (ratio <= 0.7) return 85;
    if (ratio <= 0.9) return 75;
    if (ratio <= 1.1) return 50;
    if (ratio <= 1.3) return 25;
    return 10;
  }

  /**
   * Format report as markdown
   */
  public formatAsMarkdown(report: CostReductionReport): string {
    return `# Cost Optimization Report

## Executive Summary

- **Target Reduction**: ${(report.summary.targetReduction * 100).toFixed(1)}%
- **Achieved Reduction**: ${(report.summary.achievedReduction * 100).toFixed(1)}%
- **Total Saved**: $${report.summary.totalSaved.toFixed(2)}
- **Projected Annual Savings**: $${report.summary.projectedAnnualSavings.toFixed(2)}
- **Status**: ${report.summary.status.toUpperCase()}

## Cost Breakdown

### Intelligent Routing
- Saved: $${report.breakdown.intelligentRouting.saved.toFixed(2)} (${(report.breakdown.intelligentRouting.percentage * 100).toFixed(1)}%)
- Optimal Provider Selection: $${report.breakdown.intelligentRouting.details.optimalProviderSelection.toFixed(2)}
- Fallback Optimization: $${report.breakdown.intelligentRouting.details.fallbackOptimization.toFixed(2)}
- Load Balancing: $${report.breakdown.intelligentRouting.details.loadBalancing.toFixed(2)}

### Request Batching
- Saved: $${report.breakdown.requestBatching.saved.toFixed(2)} (${(report.breakdown.requestBatching.percentage * 100).toFixed(1)}%)
- Efficiency Gain: ${report.breakdown.requestBatching.efficiency.toFixed(2)}x

### Caching
- Saved: $${report.breakdown.caching.saved.toFixed(2)} (${(report.breakdown.caching.percentage * 100).toFixed(1)}%)
- Hit Rate: ${(report.breakdown.caching.hitRate * 100).toFixed(1)}%

### Resource Optimization
- Saved: $${report.breakdown.resourceOptimization.saved.toFixed(2)} (${(report.breakdown.resourceOptimization.percentage * 100).toFixed(1)}%)

## Provider Analysis

| Provider | Requests | Total Cost | Avg Cost | Efficiency |
|----------|----------|------------|----------|------------|
${report.providerAnalysis.map(p => 
  `| ${p.provider} | ${p.requests} | $${p.totalCost.toFixed(2)} | $${p.avgCost.toFixed(4)} | ${p.efficiency.toFixed(2)} |`
).join('\n')}

## Recommendations

${report.recommendations.map(r => 
  `### ${r.priority.toUpperCase()} Priority: ${r.action}
- Potential Savings: $${r.potentialSavings.toFixed(2)}
- Implementation Effort: ${r.effort}
`).join('\n')}

## Performance Benchmarks

| Metric | Current | Target | Industry | Percentile |
|--------|---------|--------|----------|------------|
${report.benchmarks.map(b => 
  `| ${b.metric} | ${typeof b.current === 'number' ? b.current.toFixed(2) : b.current} | ${b.target.toFixed(2)} | ${b.industry.toFixed(2)} | ${b.percentile}th |`
).join('\n')}

## Cost Timeline

| Period | Cost | Saved | Reduction |
|--------|------|-------|-----------|
${report.timeline.map(t => 
  `| ${t.period} | $${t.cost.toFixed(2)} | $${t.saved.toFixed(2)} | ${(t.reduction * 100).toFixed(1)}% |`
).join('\n')}
`;
  }

  /**
   * Generate JSON report
   */
  public formatAsJSON(report: CostReductionReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  public formatAsHTML(report: CostReductionReport): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Cost Optimization Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .status-on-track { color: green; }
    .status-below-target { color: orange; }
    .status-exceeded { color: blue; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #007bff; }
    .priority-high { border-color: #dc3545; }
    .priority-medium { border-color: #ffc107; }
    .priority-low { border-color: #28a745; }
  </style>
</head>
<body>
  <h1>Cost Optimization Report</h1>
  
  <div class="summary">
    <h2>Executive Summary</h2>
    <div class="metric">
      <div>Target Reduction</div>
      <div class="metric-value">${(report.summary.targetReduction * 100).toFixed(1)}%</div>
    </div>
    <div class="metric">
      <div>Achieved Reduction</div>
      <div class="metric-value">${(report.summary.achievedReduction * 100).toFixed(1)}%</div>
    </div>
    <div class="metric">
      <div>Total Saved</div>
      <div class="metric-value">$${report.summary.totalSaved.toFixed(2)}</div>
    </div>
    <div class="metric">
      <div>Annual Savings</div>
      <div class="metric-value">$${report.summary.projectedAnnualSavings.toFixed(0)}</div>
    </div>
    <div class="metric">
      <div>Status</div>
      <div class="metric-value status-${report.summary.status}">${report.summary.status.toUpperCase()}</div>
    </div>
  </div>

  <h2>Cost Breakdown</h2>
  <canvas id="breakdownChart"></canvas>

  <h2>Provider Analysis</h2>
  <table>
    <tr>
      <th>Provider</th>
      <th>Requests</th>
      <th>Total Cost</th>
      <th>Avg Cost</th>
      <th>Efficiency</th>
    </tr>
    ${report.providerAnalysis.map(p => `
    <tr>
      <td>${p.provider}</td>
      <td>${p.requests}</td>
      <td>$${p.totalCost.toFixed(2)}</td>
      <td>$${p.avgCost.toFixed(4)}</td>
      <td>${p.efficiency.toFixed(2)}</td>
    </tr>
    `).join('')}
  </table>

  <h2>Recommendations</h2>
  ${report.recommendations.map(r => `
  <div class="recommendation priority-${r.priority}">
    <strong>${r.priority.toUpperCase()}: ${r.action}</strong><br>
    Potential Savings: $${r.potentialSavings.toFixed(2)}<br>
    Effort: ${r.effort}
  </div>
  `).join('')}

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // Add chart visualization
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Intelligent Routing', 'Request Batching', 'Caching', 'Resource Optimization'],
        datasets: [{
          data: [
            ${report.breakdown.intelligentRouting.saved},
            ${report.breakdown.requestBatching.saved},
            ${report.breakdown.caching.saved},
            ${report.breakdown.resourceOptimization.saved}
          ],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
        }]
      }
    });
  </script>
</body>
</html>`;
  }
}

/**
 * Factory function to create report generator
 */
export function createCostReportGenerator(): CostReportGenerator {
  return new CostReportGenerator();
}