export const MOCK_USER = {
  uid: "dev-guest-uid",
  email: "guest@crm-os.local",
  displayName: "Developer Guest",
  isAnonymous: true,
  emailVerified: true,
};

export function setMockUser() {
  localStorage.setItem("crm_os_mock_user", JSON.stringify(MOCK_USER));
  window.location.reload();
}

export function getMockUser() {
  try {
    const stored = localStorage.getItem("crm_os_mock_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearMockUser() {
  localStorage.removeItem("crm_os_mock_user");
  window.location.reload();
}
