// Thrown by the store when a unique constraint on customers is hit.
export class DuplicateCustomerError extends Error {
  constructor(field) {
    super(`duplicate customer ${field}`);
    this.name = 'DuplicateCustomerError';
    this.field = field; // 'phone' | 'email'
  }
}

export class DuplicateAdminEmailError extends Error {
  constructor() {
    super('duplicate admin email');
    this.name = 'DuplicateAdminEmailError';
  }
}

// Thrown when a change would leave the café without an active owner.
export class LastOwnerError extends Error {
  constructor() {
    super('cannot remove the last active owner');
    this.name = 'LastOwnerError';
  }
}
