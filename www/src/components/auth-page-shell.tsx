function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      {children}
    </main>
  )
}

export { AuthPageShell }
