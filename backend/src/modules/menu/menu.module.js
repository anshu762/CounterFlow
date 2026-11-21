import { requireAuth } from '../../middleware/auth.js';
import { requireCurrentRole } from '../../middleware/freshAuth.js';
import { createCloudinaryStorage } from '../uploads/cloudinaryStorage.js';
import { createMenuRoutes } from './menu.routes.js';
import { createMenuService } from './menu.service.js';
import { createMenuStore } from './menu.store.js';

// One call wires store, service, auth guards and routes together.
export function createMenuModule({ pool, authStore, menuStore, imageStorage }) {
  const store = menuStore ?? createMenuStore(pool);
  const storage = imageStorage ?? createCloudinaryStorage();
  const service = createMenuService({ store, imageStorage: storage });
  const guards = {
    staff: [requireAuth, requireCurrentRole(authStore, 'owner', 'staff')],
    owner: [requireAuth, requireCurrentRole(authStore, 'owner')],
  };
  return createMenuRoutes({ service, guards });
}
