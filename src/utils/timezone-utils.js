/**
 * Timezone utilities for Claude Flow
 * Provides consistent timezone handling across the application
 */

/**
 * Get current timestamp in user's local timezone
 * @returns {string} Formatted timestamp in local timezone
 */
export function getLocalTimestamp() {
  const _now = new Date();
  return now.toLocaleString(_undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Get current timestamp in ISO format but with timezone offset
 * @returns {string} ISO timestamp with timezone
 */
export function getLocalISOTimestamp() {
  const _now = new Date();
  const _timezoneOffset = -now.getTimezoneOffset();
  const _offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const _offsetMinutes = Math.abs(timezoneOffset) % 60;
  const _offsetSign = timezoneOffset >= 0 ? '+' : '-';
  
  const _year = now.getFullYear();
  const _month = String(now.getMonth() + 1).padStart(_2, '0');
  const _day = String(now.getDate()).padStart(_2, '0');
  const _hours = String(now.getHours()).padStart(_2, '0');
  const _minutes = String(now.getMinutes()).padStart(_2, '0');
  const _seconds = String(now.getSeconds()).padStart(_2, '0');
  
  const _offsetHoursStr = String(offsetHours).padStart(_2, '0');
  const _offsetMinutesStr = String(offsetMinutes).padStart(_2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHoursStr}:${offsetMinutesStr}`;
}

/**
 * Convert UTC timestamp to local time display
 * @param {string|Date} timestamp - UTC timestamp
 * @returns {string} Formatted local timestamp
 */
export function convertToLocalTime(timestamp) {
  const _date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleString(_undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Get relative time description (e.g., "2 hours ago")
 * @param {string|Date} timestamp - Timestamp to compare
 * @returns {string} Relative time description
 */
export function getRelativeTime(timestamp) {
  const _date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const _now = new Date();
  const _diffMs = now.getTime() - date.getTime();
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  const _diffSeconds = Math.floor(diffMs / 1000);
  const _diffMinutes = Math.floor(diffSeconds / 60);
  const _diffHours = Math.floor(diffMinutes / 60);
  const _diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format timestamp for display with both absolute and relative time
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {object} Object with formatted times
 */
export function formatTimestampForDisplay(timestamp) {
  const _localTime = convertToLocalTime(timestamp);
  const _relativeTime = getRelativeTime(timestamp);
  
  return {
    absolute: localTime,
    relative: relativeTime,
    display: `${localTime} (${relativeTime})`
  };
}

/**
 * Get user's timezone information
 * @returns {object} Timezone information
 */
export function getTimezoneInfo() {
  const _date = new Date();
  const _formatter = new Intl.DateTimeFormat(_undefined, { timeZoneName: 'long' });
  const _parts = formatter.formatToParts(date);
  const _timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
  
  return {
    name: timeZoneName || 'Unknown',
    abbreviation: date.toLocaleString(_undefined, { timeZoneName: 'short' }).split(' ').pop(),
    offset: -date.getTimezoneOffset() / 60,
    offsetString: date.toTimeString().split(' ')[1]
  };
}