import Image from 'next/image';

export const Logo = () => {
    return (
        <div className="relative h-10 w-40">
            <Image
                src="/ekg-logo-v2.jpg"
                alt="EKGKala"
                fill
                className="object-contain"
                priority
            />
        </div>
    );
};
