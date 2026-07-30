fetch("http://localhost:3000/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@mangareader.pro",
    password: "adminpassword123!",
    displayName: "Super Admin"
  })
}).then(res => res.json()).then(console.log).catch(console.error);
