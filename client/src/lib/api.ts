// Simple API client without double encoding issues
export async function apiCall(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || text;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function login(email: string, password: string) {
  return apiCall('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

export async function register(userData: any) {
  return apiCall('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
}

export async function logout() {
  return apiCall('/api/logout', {
    method: 'POST',
  });
}