# Use the AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Copy dependency files first
COPY package*.json ./

# Install production dependencies using npm
RUN npm ci --omit=dev

# Copy the rest of your backend source code
COPY . .

# Lambda entrypoint
CMD [ "lambda.handler" ]
