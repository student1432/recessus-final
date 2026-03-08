const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// EMERGENCY FALLBACK: If things don't reveal in 2 seconds, show them anyway
setTimeout(() => {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
}, 2000);