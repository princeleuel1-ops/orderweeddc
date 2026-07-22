export function canAccessAdmin(session) {
  return session?.role === 'ADMIN';
}

export function canAccessCustomer(session) {
  return session?.role === 'CUSTOMER';
}

export function canManageRetailer(session, retailerId) {
  return (
    session?.role === 'RETAILER_MANAGER' &&
    typeof session.managedRetailerId === 'string' &&
    session.managedRetailerId.length > 0 &&
    session.managedRetailerId === retailerId
  );
}
