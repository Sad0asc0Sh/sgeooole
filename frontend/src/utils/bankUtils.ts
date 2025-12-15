
export const banks = [
    { code: '010', name: 'بانک مرکزی', icon: 'markazi', color: '#333' },
    { code: '011', name: 'بانک صنعت و معدن', icon: 'sanat-madan', color: '#bfa668' },
    { code: '012', name: 'بانک ملت', icon: 'mellat', color: '#be1e2d' },
    { code: '013', name: 'بانک رفاه', icon: 'refah', color: '#005e8d' },
    { code: '014', name: 'بانک مسکن', icon: 'maskan', color: '#ea5b0c' },
    { code: '015', name: 'بانک سپه', icon: 'sepah', color: '#ffc107' },
    { code: '016', name: 'بانک کشاورزی', icon: 'keshavarzi', color: '#3f7e44' },
    { code: '017', name: 'بانک ملی', icon: 'melli', color: '#0077b6' },
    { code: '018', name: 'بانک تجارت', icon: 'tejarat', color: '#004e92' },
    { code: '019', name: 'بانک صادرات', icon: 'saderat', color: '#1a237e' },
    { code: '020', name: 'بانک توسعه صادرات', icon: 'tose-saderat', color: '#f57f17' },
    { code: '021', name: 'پست بانک', icon: 'post', color: '#2e7d32' },
    { code: '022', name: 'بانک توسعه تعاون', icon: 'tose-taavon', color: '#0277bd' },
    { code: '051', name: 'موسسه اعتباری توسعه', icon: 'tose', color: '#455a64' },
    { code: '053', name: 'بانک کارآفرین', icon: 'karafarin', color: '#388e3c' },
    { code: '054', name: 'بانک پارسیان', icon: 'parsian', color: '#d32f2f' },
    { code: '055', name: 'بانک اقتصاد نوین', icon: 'eghtesad-novin', color: '#512da8' },
    { code: '056', name: 'بانک سامان', icon: 'saman', color: '#0288d1' },
    { code: '057', name: 'بانک پاسارگاد', icon: 'pasargad', color: '#fbc02d' },
    { code: '058', name: 'بانک سرمایه', icon: 'sarmayeh', color: '#7b1fa2' },
    { code: '059', name: 'بانک سینا', icon: 'sina', color: '#0097a7' },
    { code: '060', name: 'بانک مهر ایران', icon: 'mehr-iran', color: '#2e7d32' },
    { code: '061', name: 'بانک شهر', icon: 'shahr', color: '#d84315' },
    { code: '062', name: 'بانک آینده', icon: 'ayandeh', color: '#795548' },
    { code: '064', name: 'بانک گردشگری', icon: 'gardeshgari', color: '#424242' },
    { code: '066', name: 'بانک دی', icon: 'dey', color: '#00bcd4' },
    { code: '069', name: 'بانک ایران زمین', icon: 'iran-zamin', color: '#cddc39' },
    { code: '070', name: 'بانک رسالت', icon: 'resalat', color: '#00acc1' },
    { code: '078', name: 'بانک خاورمیانه', icon: 'khavarmianeh', color: '#607d8b' },
    { code: '090', name: 'بانک مهر اقتصاد', icon: 'mehr-eghtesad', color: '#4e342e' }, // Merged but might still exist in old IBANs
    { code: '095', name: 'بانک ایران و ونزوئلا', icon: 'iran-venezuela', color: '#d50000' },
];

export const getBankFromSheba = (sheba: string) => {
    if (!sheba || sheba.length < 8) return null;

    // Remove IR if present and spaces
    const cleanSheba = sheba.toUpperCase().replace('IR', '').replace(/\s/g, '');

    // Check length (should be 24 digits after removing IR)
    if (cleanSheba.length !== 24) return null;

    // Extract bank code (digits 2 to 5 in the 24-digit string? No, structure is:
    // CC (Check digits) + BBB (Bank code) + 0 (Account type) + ...
    // Actually standard is: IRkk BBBA AAAA AAAA AAAA AAAA AA
    // IR + 2 check digits + 3 bank code + ...
    // So in the 24 digit part (without IR), it is:
    // digits 0-1: Check digits
    // digits 2-4: Bank code (3 digits)

    const bankCode = cleanSheba.substring(2, 5);

    return banks.find(b => b.code === bankCode) || null;
};

export const validateSheba = (sheba: string) => {
    if (!sheba) return false;
    const cleanSheba = sheba.toUpperCase().replace('IR', '').replace(/\s/g, '');
    if (cleanSheba.length !== 24) return false;
    // Basic numeric check
    return /^\d+$/.test(cleanSheba);
    // Full ISO 7064 Mod 97-10 check is complex to implement quickly without library, 
    // but we can rely on length and bank code existence for UI feedback.
};
