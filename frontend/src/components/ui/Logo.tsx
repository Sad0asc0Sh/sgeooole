import Image from 'next/image';

export const Logo = () => {
    return (
        <div className="relative h-16 w-64">
            <Image
                src="/logo-text-high-res.jpg"
                alt="EKGKala Logo"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain"
                priority
            />
        </div>
    );
};
