/** ioredis client-এর DI token — module ও service দুটোই এখান থেকে import করে
 *  (circular import এড়াতে আলাদা ফাইলে রাখা)। */
export const REDIS_CLIENT = 'REDIS_CLIENT';
