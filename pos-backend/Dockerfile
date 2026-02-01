# Use the AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Install Yarn globally
RUN npm install -g yarn

# Copy dependency files first
COPY package.json yarn.lock ./

# Install production dependencies using Yarn
RUN yarn install --production

# Copy the rest of your backend source code
COPY . .

# Lambda entrypoint
CMD [ "lambda.handler" ]