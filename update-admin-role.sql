-- Update user role to admin for testing
UPDATE users 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'josephkwantum@gmail.com';

-- Verify the update
SELECT id, name, email, role, created_at, updated_at 
FROM users 
WHERE email = 'josephkwantum@gmail.com';
