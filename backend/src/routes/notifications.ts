import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

// GET /api/v1/notifications
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', req.user!.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) return res.json(data);
      } catch {}
    }

    // Fallback to mockStore
    const userNotifs = mockStore.notifications.filter(
      (n: any) => !n.recipient_id || n.recipient_id === req.user!.id
    );
    res.json(userNotifs);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', req.params.id)
          .eq('recipient_id', req.user!.id);
      } catch {}
    }

    const notif = mockStore.notifications.find((n: any) => n.id === req.params.id);
    if (notif) notif.is_read = true;

    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/mark-all-read
router.patch('/mark-all-read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', req.user!.id)
          .eq('is_read', false);
      } catch {}
    }

    mockStore.notifications.forEach((n: any) => {
      if (!n.recipient_id || n.recipient_id === req.user!.id) {
        n.is_read = true;
      }
    });

    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
});

export default router;
