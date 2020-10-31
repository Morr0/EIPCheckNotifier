Often when experimenting along with AWS, you spin up EC2 instances that you may use. More often than not restarting those instances results in IP changes, so you attach an Elastic IP address which is an IPv4. Thus is a scarce resource and for this reason, if not used, will result in an hourly charge cited in [EC2 Pricing](https://aws.amazon.com/ec2/pricing/).

So I sought to create a job that checks all of my Elastic IP addresses throughout my **enabled** regions. I decided to use [AWS lambda](https://aws.amazon.com/lambda/) for it as it is intended for these types of things. It has a max running time of 15 minutes which is plentiful for these kinds of tasks. I got the function built in this article to run around 900 ms. Will also use [SNS](https://aws.amazon.com/sns/) to notify the intended recipient, be it by E-mail, SMS or any other means the service has to offer.

The workflow will consist of the following tasks:
- Run the function on a schedule
- Check for all of the EIPs
- Notify to an SNS topic if unattached EIPs exist

## Step 1: creating the SNS topic
I won't delve into exact details on how to make/do specific things as the AWS console is pretty easy to use. Will create a `Standard` topic named `EIPCheckNotifier`.
![Step 1](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/1.PNG)

Will also subscribe by email to a temporary email in this case.

![Step 1b](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/2.PNG)

## Step 2: create the IAM policy to be used
Although I can use an already existing policies, but for best AWS and security practices, it is always better to use only the required privilliges. This policy will be used to create a Lambda role. That is, a role intended to be used by Lambda.

The policy below, has 2 statements, both will issue **Allow** effects. As IAM is **Deny** by default, we should define what we need. The first statement issues the ability to describe all elastic IPs in all of my **enabled** regions. The second statement, defines the ability to **publish** to SNS and more specifically specifying a specific resource. That resource is the ARN (Amazon Resource Number) of the SNS topic I want to notify to.

![Step 2](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/3.PNG)

Then created a role that I named `EIPCheckNotifierLambdaRole` to be used by the lambda function next.

## Step 3: create the lambda function
Will name the lambda and specify it to use the role I created earlier.

![Step 4](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/4.PNG)

Then the following basic code is shown:

![Step 4b](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/5.PNG)

I didn't play with the timeout of the function which defaults to 3 seconds going up to 15 minutes as 2 simple API calls won't amount to much execution time.

## Step 6: create the scheduler using Amazon EventBridge
Navigating to EventBridge, creating a new rule to run on a fixed schedule. Every 24 hours.

![Step 6](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/6.PNG)

Then integrating with the lambda function as a target. Note that you can integrate with other AWS services as well and have more than one target:

![Step 6b](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/7.PNG)

## Conclusion:
This was an interesting little task showing a coordinated use of various AWS services. SNS was used to send out notificiations to subscribers who in this case maybe a cloud engineer. Lambda was used to do the computation part.