import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
        formatters: {
            level(label: string) {
                return { level: label };
            },
        },
    }),
});

export default logger;
