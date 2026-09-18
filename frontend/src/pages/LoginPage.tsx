import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

const DEMO = [
  { role: 'Fleet Manager', email: 'manager@nayatransit.com' },
  { role: 'Safety Officer', email: 'safety@nayatransit.com' },
  { role: 'Financial Analyst', email: 'finance@nayatransit.com' },
  { role: 'Driver', email: 'driver@nayatransit.com' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('manager@nayatransit.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Truck className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">TransitOps</h1>
          <p className="text-sm text-muted-foreground">Smart Transport Operations Platform</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <Card className="mt-4 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Demo accounts · password: password123
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword('password123');
                }}
                className="rounded-md border px-3 py-2 text-left text-xs hover:bg-accent"
              >
                <span className="block font-medium">{d.role}</span>
                <span className="block text-muted-foreground">{d.email}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
