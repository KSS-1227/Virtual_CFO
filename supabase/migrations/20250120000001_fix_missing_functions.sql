-- Create missing get_month_name function
CREATE OR REPLACE FUNCTION public.get_month_name(month_num integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  CASE month_num
    WHEN 1 THEN RETURN 'January';
    WHEN 2 THEN RETURN 'February';
    WHEN 3 THEN RETURN 'March';
    WHEN 4 THEN RETURN 'April';
    WHEN 5 THEN RETURN 'May';
    WHEN 6 THEN RETURN 'June';
    WHEN 7 THEN RETURN 'July';
    WHEN 8 THEN RETURN 'August';
    WHEN 9 THEN RETURN 'September';
    WHEN 10 THEN RETURN 'October';
    WHEN 11 THEN RETURN 'November';
    WHEN 12 THEN RETURN 'December';
    ELSE RETURN 'Unknown';
  END CASE;
END;
$$;