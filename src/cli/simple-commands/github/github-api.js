#!/usr/bin/env node
/* eslint-env node */
/**
 * GitHub API Integration Module
 * Provides authentication, rate limiting, and API wrappers for GitHub workflow commands
 */
import { printSuccess, printError, printWarning, printInfo } from '../utils.js';
// GitHub API Configuration
const _GITHUB_API_BASE = 'https://api.github.com';
const _GITHUB_RATE_LIMIT = 5000; // API calls per hour
const _GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
class GitHubAPIClient {
  constructor(token = null) {
    this.token = token || process.env.GITHUB_TOKEN;
    this.rateLimitRemaining = GITHUB_RATE_LIMIT;
    this.rateLimitResetTime = null;
    this.lastRequestTime = 0;
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }
  /**
   * Authentication Methods
   */
  async authenticate(token = null) {
    if (token) {
      this.token = token;
    }
    if (!this.token) {
      printError('GitHub token not found. Set GITHUB_TOKEN environment variable or provide token.');
      return false;
    }
    try {
      const _response = await this.request('/user');
      if (response.success) {
        printSuccess(`Authenticated as ${response.data.login}`);
        return true;
      }
      return false;
    } catch (_error) {
      printError(`Authentication failed: ${error.message}`);
      return false;
    }
  }
  /**
   * Rate Limiting Management
   */
  async checkRateLimit() {
    if (this.rateLimitRemaining <= 1) {
      const _resetTime = new Date(this.rateLimitResetTime);
      const _now = new Date();
      const _waitTime = resetTime.getTime() - now.getTime();
      
      if (waitTime > 0) {
        printWarning(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
      }
    }
  }
  updateRateLimitInfo(headers) {
    this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'] || '0');
    this.rateLimitResetTime = new Date(
      (parseInt(headers['x-ratelimit-reset']) || 0) * 1000
    );
  }
  /**
   * Core API Request Method
   */
  async request(_endpoint, options = { /* empty */ }) {
    await this.checkRateLimit();
    const _url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;
    const _headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Claude-Flow-GitHub-Integration',
      ...options.headers
    };
    const _requestOptions = {
      method: options.method || 'GET',
      headers,
      ...options
    };
    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }
    try {
      const _response = await fetch(_url, requestOptions);
      this.updateRateLimitInfo(response.headers);
      const _data = await response.json();
      if (!response.ok) {
        throw new Error(`GitHub API error: ${data.message || response.statusText}`);
      }
      return {
        success: true,
        data,
        headers: response.headers,
        status: response.status
      };
    } catch (_error) {
      return {
        success: false,
        error: error.message,
        status: error.status || 500
      };
    }
  }
  /**
   * Repository Operations
   */
  async getRepository(_owner, repo) {
    return await this.request(`/repos/${owner}/${repo}`);
  }
  async listRepositories(options = { /* empty */ }) {
    const _params = new URLSearchParams({
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      per_page: options.perPage || _30,
      page: options.page || 1
    });
    return await this.request(`/user/repos?${params}`);
  }
  async createRepository(repoData) {
    return await this.request('/user/repos', {
      method: 'POST',
      body: repoData
    });
  }
  /**
   * Pull Request Operations
   */
  async listPullRequests(_owner, _repo, options = { /* empty */ }) {
    const _params = new URLSearchParams({
      state: options.state || 'open',
      sort: options.sort || 'created',
      direction: options.direction || 'desc',
      per_page: options.perPage || _30,
      page: options.page || 1
    });
    return await this.request(`/repos/${owner}/${repo}/pulls?${params}`);
  }
  async createPullRequest(_owner, _repo, prData) {
    return await this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: prData
    });
  }
  async updatePullRequest(_owner, _repo, _prNumber, prData) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: prData
    });
  }
  async mergePullRequest(_owner, _repo, _prNumber, mergeData) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: mergeData
    });
  }
  async requestPullRequestReview(_owner, _repo, _prNumber, reviewData) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
      method: 'POST',
      body: reviewData
    });
  }
  /**
   * Issue Operations
   */
  async listIssues(_owner, _repo, options = { /* empty */ }) {
    const _params = new URLSearchParams({
      state: options.state || 'open',
      sort: options.sort || 'created',
      direction: options.direction || 'desc',
      per_page: options.perPage || _30,
      page: options.page || 1
    });
    if (options.labels) {
      params.append('labels', options.labels);
    }
    return await this.request(`/repos/${owner}/${repo}/issues?${params}`);
  }
  async createIssue(_owner, _repo, issueData) {
    return await this.request(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: issueData
    });
  }
  async updateIssue(_owner, _repo, _issueNumber, issueData) {
    return await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: issueData
    });
  }
  async addIssueLabels(_owner, _repo, _issueNumber, labels) {
    return await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
      method: 'POST',
      body: { labels }
    });
  }
  async assignIssue(_owner, _repo, _issueNumber, assignees) {
    return await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
      method: 'POST',
      body: { assignees }
    });
  }
  /**
   * Release Operations
   */
  async listReleases(_owner, _repo, options = { /* empty */ }) {
    const _params = new URLSearchParams({
      per_page: options.perPage || _30,
      page: options.page || 1
    });
    return await this.request(`/repos/${owner}/${repo}/releases?${params}`);
  }
  async createRelease(_owner, _repo, releaseData) {
    return await this.request(`/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      body: releaseData
    });
  }
  async updateRelease(_owner, _repo, _releaseId, releaseData) {
    return await this.request(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      method: 'PATCH',
      body: releaseData
    });
  }
  async deleteRelease(_owner, _repo, releaseId) {
    return await this.request(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      method: 'DELETE'
    });
  }
  /**
   * Workflow Operations
   */
  async listWorkflows(_owner, repo) {
    return await this.request(`/repos/${owner}/${repo}/actions/workflows`);
  }
  async triggerWorkflow(_owner, _repo, _workflowId, ref = 'main', inputs = { /* empty */ }) {
    return await this.request(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      body: { _ref, inputs }
    });
  }
  async listWorkflowRuns(_owner, _repo, options = { /* empty */ }) {
    const _params = new URLSearchParams({
      per_page: options.perPage || _30,
      page: options.page || 1
    });
    if (options.status) {
      params.append('status', options.status);
    }
    return await this.request(`/repos/${owner}/${repo}/actions/runs?${params}`);
  }
  /**
   * Branch Operations
   */
  async listBranches(_owner, repo) {
    return await this.request(`/repos/${owner}/${repo}/branches`);
  }
  async createBranch(_owner, _repo, _branchName, sha) {
    return await this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: {
        ref: `refs/heads/${branchName}`,
        sha
      }
    });
  }
  async getBranchProtection(_owner, _repo, branch) {
    return await this.request(`/repos/${owner}/${repo}/branches/${branch}/protection`);
  }
  async updateBranchProtection(_owner, _repo, _branch, protection) {
    return await this.request(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
      method: 'PUT',
      body: protection
    });
  }
  /**
   * Webhook Operations
   */
  async listWebhooks(_owner, repo) {
    return await this.request(`/repos/${owner}/${repo}/hooks`);
  }
  async createWebhook(_owner, _repo, webhookData) {
    return await this.request(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: webhookData
    });
  }
  async updateWebhook(_owner, _repo, _hookId, webhookData) {
    return await this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'PATCH',
      body: webhookData
    });
  }
  async deleteWebhook(_owner, _repo, hookId) {
    return await this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE'
    });
  }
  /**
   * Event Processing
   */
  async processWebhookEvent(_event, _signature, payload) {
    if (!this.verifyWebhookSignature(_signature, payload)) {
      throw new Error('Invalid webhook signature');
    }
    const _eventData = JSON.parse(payload);
    
    switch (_event) {
      case 'push':
        return this.handlePushEvent(eventData);
      case 'pull_request':
        return this.handlePullRequestEvent(eventData);
      case 'issues':
        return this.handleIssuesEvent(eventData);
      case 'release':
        return this.handleReleaseEvent(eventData);
      case 'workflow_run':
        return this.handleWorkflowRunEvent(eventData);
      default:
        printInfo(`Unhandled event type: ${event}`);
        return { handled: false, event };
    }
  }
  verifyWebhookSignature(_signature, payload) {
    if (!GITHUB_WEBHOOK_SECRET) {
      printWarning('GITHUB_WEBHOOK_SECRET not set. Skipping signature verification.');
      return true;
    }
    const _crypto = require('crypto');
    const _hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    hmac.update(payload);
    const _expectedSignature = `sha256=${hmac.digest('hex')}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  /**
   * Event Handlers
   */
  async handlePushEvent(eventData) {
    printInfo(`Push event: ${eventData.commits.length} commits to ${eventData.ref}`);
    return { handled: true, event: 'push', data: eventData };
  }
  async handlePullRequestEvent(eventData) {
    const _action = eventData.action;
    const _pr = eventData.pull_request;
    printInfo(`Pull request ${action}: #${pr.number} - ${pr.title}`);
    return { handled: true, event: 'pull_request', action, data: eventData };
  }
  async handleIssuesEvent(eventData) {
    const _action = eventData.action;
    const _issue = eventData.issue;
    printInfo(`Issue ${action}: #${issue.number} - ${issue.title}`);
    return { handled: true, event: 'issues', action, data: eventData };
  }
  async handleReleaseEvent(eventData) {
    const _action = eventData.action;
    const _release = eventData.release;
    printInfo(`Release ${action}: ${release.tag_name} - ${release.name}`);
    return { handled: true, event: 'release', action, data: eventData };
  }
  async handleWorkflowRunEvent(eventData) {
    const _action = eventData.action;
    const _workflowRun = eventData.workflow_run;
    printInfo(`Workflow run ${action}: ${workflowRun.name} - ${workflowRun.conclusion}`);
    return { handled: true, event: 'workflow_run', action, data: eventData };
  }
  /**
   * Utility Methods
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(_resolve, ms));
  }
  parseRepository(repoString) {
    const _match = repoString.match(/^([^/]+)/([^/]+)$/);
    if (!match) {
      throw new Error('Invalid repository format. Use: owner/repo');
    }
    return { owner: match[1], repo: match[2] };
  }
  formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }
  formatFileSize(bytes) {
    const _units = ['B', 'KB', 'MB', 'GB'];
    let _size = bytes;
    let _unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
// Export singleton instance
export const _githubAPI = new GitHubAPIClient();
export default GitHubAPIClient;