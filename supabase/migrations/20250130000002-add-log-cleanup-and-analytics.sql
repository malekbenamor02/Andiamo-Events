-- Automatic log cleanup function
-- Deletes logs older than specified days (default: 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.site_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: This only works if pg_cron is enabled in your Supabase project
-- If pg_cron is not available, you can call this function manually or via an API endpoint
COMMENT ON FUNCTION cleanup_old_logs IS 'Automatically deletes logs older than specified days. Default: 30 days.';

-- Function to get log statistics
CREATE OR REPLACE FUNCTION get_log_statistics(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_logs', COUNT(*),
    'by_type', (
      SELECT json_object_agg(log_type, count)
      FROM (
        SELECT log_type, COUNT(*) as count
        FROM public.site_logs
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY log_type
      ) t
    ),
    'by_category', (
      SELECT json_object_agg(category, count)
      FROM (
        SELECT category, COUNT(*) as count
        FROM public.site_logs
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY category
      ) t
    ),
    'error_count', COUNT(*) FILTER (WHERE log_type = 'error'),
    'error_rate', ROUND(
      100.0 * COUNT(*) FILTER (WHERE log_type = 'error') / 
      NULLIF(COUNT(*), 0),
      2
    ),
    'most_visited_pages', (
      SELECT json_agg(json_build_object('page', page_url, 'count', count) ORDER BY count DESC)
      FROM (
        SELECT page_url, COUNT(*) as count
        FROM public.site_logs
        WHERE category = 'page_view'
          AND created_at BETWEEN start_date AND end_date
          AND page_url IS NOT NULL
        GROUP BY page_url
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'most_submitted_forms', (
      SELECT json_agg(json_build_object('form', form_name, 'count', count) ORDER BY count DESC)
      FROM (
        SELECT details->>'formName' as form_name, COUNT(*) as count
        FROM public.site_logs
        WHERE category = 'form_submission'
          AND created_at BETWEEN start_date AND end_date
          AND details IS NOT NULL
        GROUP BY details->>'formName'
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'login_attempts', (
      SELECT json_build_object(
        'total', COUNT(*),
        'successful', COUNT(*) FILTER (WHERE log_type = 'success' AND category = 'authentication'),
        'failed', COUNT(*) FILTER (WHERE log_type = 'warning' AND category = 'authentication')
      )
      FROM public.site_logs
      WHERE category = 'authentication'
        AND created_at BETWEEN start_date AND end_date
    ),
    'top_errors', (
      SELECT json_agg(json_build_object('message', message, 'count', count) ORDER BY count DESC)
      FROM (
        SELECT message, COUNT(*) as count
        FROM public.site_logs
        WHERE log_type = 'error'
          AND created_at BETWEEN start_date AND end_date
        GROUP BY message
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'user_types', (
      SELECT json_object_agg(user_type, count)
      FROM (
        SELECT COALESCE(user_type, 'unknown') as user_type, COUNT(*) as count
        FROM public.site_logs
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY user_type
      ) t
    )
  ) INTO result
  FROM public.site_logs
  WHERE created_at BETWEEN start_date AND end_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_log_statistics IS 'Returns comprehensive log statistics including errors, page views, form submissions, and more';

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  lookback_hours INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'multiple_failed_logins', (
      SELECT json_agg(json_build_object('email', details->>'email', 'attempts', count))
      FROM (
        SELECT details->>'email' as email, COUNT(*) as count
        FROM public.site_logs
        WHERE category = 'authentication'
          AND log_type = 'warning'
          AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
          AND details->>'email' IS NOT NULL
        GROUP BY details->>'email'
        HAVING COUNT(*) >= 3
      ) t
    ),
    'unusual_error_rate', (
      SELECT CASE
        WHEN error_count > 10 THEN json_build_object(
          'alert', true,
          'error_count', error_count,
          'time_period', lookback_hours || ' hours'
        )
        ELSE json_build_object('alert', false, 'error_count', error_count)
      END
      FROM (
        SELECT COUNT(*) as error_count
        FROM public.site_logs
        WHERE log_type = 'error'
          AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
      ) t
    ),
    'recent_errors', (
      SELECT json_agg(json_build_object(
        'message', message,
        'count', count,
        'last_occurrence', last_occurrence
      ) ORDER BY count DESC)
      FROM (
        SELECT 
          message,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM public.site_logs
        WHERE log_type = 'error'
          AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
        GROUP BY message
        ORDER BY count DESC
        LIMIT 5
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_suspicious_activity IS 'Detects suspicious activity patterns like multiple failed logins and unusual error rates';

-- Function to get user journey
CREATE OR REPLACE FUNCTION get_user_journey(
  session_id TEXT DEFAULT NULL,
  user_type_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'page', page_url,
    'timestamp', created_at,
    'category', category,
    'details', details
  ) ORDER BY created_at)
  INTO result
  FROM public.site_logs
  WHERE (session_id IS NULL OR details->>'sessionId' = session_id)
    AND (user_type_filter IS NULL OR user_type = user_type_filter)
    AND category IN ('page_view', 'form_submission', 'authentication')
    AND page_url IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 100;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_journey IS 'Tracks user journey through pages and actions';

-- Grant execute permissions to authenticated users (admins)
GRANT EXECUTE ON FUNCTION cleanup_old_logs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_log_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_journey(TEXT, TEXT) TO authenticated;







