import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from '../utils/supabase';

async function bootstrapAdmin() {
  const email = process.env.ADMIN_INITIAL_EMAIL || 'admin@cognify.edu';
  const password = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
  const fullName = process.env.ADMIN_INITIAL_NAME || 'System Administrator';

  console.log(`[BOOTSTRAP] Checking if initial admin exists (${email})...`);

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    console.log(`[BOOTSTRAP] Admin user ${email} already exists with ID ${existing.id}.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      email: email.toLowerCase(),
      full_name: fullName,
      role: 'admin',
      password_hash: passwordHash,
      is_active: true,
      status: 'approved',
    })
    .select()
    .single();

  if (error) {
    console.error('[BOOTSTRAP] Failed to create initial admin user:', error.message);
    process.exit(1);
  }

  console.log('----------------------------------------------------');
  console.log(' CogniFy Initial Administrator Account Created');
  console.log('----------------------------------------------------');
  console.log(` Email:    ${email}`);
  console.log(` Password: ${password}`);
  console.log(` Role:     admin`);
  console.log(' Please change this password upon your first login.');
  console.log('----------------------------------------------------');
  process.exit(0);
}

bootstrapAdmin().catch((err) => {
  console.error('[BOOTSTRAP] Unexpected error:', err);
  process.exit(1);
});
