-- Rename pg_enum value from 'handled' to 'handheld'
ALTER TYPE device_type RENAME VALUE 'handled' TO 'handheld';

-- Add nullable image column to hardware table
ALTER TABLE hardware ADD COLUMN image text;
