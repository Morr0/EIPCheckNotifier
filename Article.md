Often when experimenting along with AWS, you spin up EC2 instances that you may use. More often than not restarting those instances results in IP changes, so you attach an Elastic IP address which is an IPv4. Thus is a scarce resource and for this reason, if not used, will result in an hourly charge cited in [EC2 Pricing](https://aws.amazon.com/ec2/pricing/).

Note that this article won't delve into step-by-step specifics but will delve into more of the design/code rather than exactly which buttons to click. I assume you can figure out your way along the AWS console.

So I sought to create a job that checks all of my Elastic IP (**EIP**) addresses throughout my **enabled** regions. It will not release those EIPs as that is the cloud engineer's responsibility's.

I decided to use [AWS lambda](https://aws.amazon.com/lambda/) for it as it is intended for these types of things on a Node.js runtime. It has a max running time of 15 minutes which is plentiful for these kinds of tasks. I got the function built in this article to run around 900 ms. Will also use [SNS](https://aws.amazon.com/sns/) to notify the intended recipient, be it by E-mail, SMS or any other means the service has to offer.

The workflow will consist of the following tasks:
- Run the function on a schedule by AWS EventBridge
- Check for all of the EIPs
- Notify to an SNS topic if unattached EIPs exist

## Step 1: creating the SNS topic
Will create a `Standard` SNS topic named `EIPCheckNotifier`.
![Step 1](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/1.PNG)

Will also subscribe by email to a temporary email in this case. You could use other means of subscriptions as listed [here](https://docs.aws.amazon.com/sns/latest/dg/welcome.html), some of which have some limits and differing prices.

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

I didn't play with the timeout of the function which defaults to 3 seconds going up to 15 minutes as 2 simple API calls won't amount to much execution time. You may need to increase it to be in the clear, sometimes AWS traffic is congested and API calls will take some time.

## Step 5: the code
All code will be placed in the event handler for simplicity sake.

The code will begin by declaring the 2 clients that will be used, the EC2 client and SNS client. The reason for EC2 is because Elastic IPs are associated with instances and the folks at AWS put their APIs in the EC2 Api. Will also initialize an array to hold the unattached EIPs that will find later on.
``` Javascript
const ec2Client = new AWS.EC2();
const snsClient = new AWS.SNS();
let unattachedEIPs = [];
```

Then will issue a `describeAddresses` call to EC2 which will return all EIPs attached or unattached. Now, filtering those EIPs by looping through the `Addresses` array from the response JSON. Checking for EIPs where their attached instance is `undefined` and adding them to the array declared above.
``` Javascript
const eipsResponse = await ec2Client.describeAddresses({}).promise();
    
if (eipsResponse.Addresses.length > 0){
	for (const eip of eipsResponse.Addresses){
		if (!("InstanceId" in eip)){
			unattachedEIPs.push(eip);
			console.log(`unattached EIP: ${eip}`);
		}
	}
}
```

Now I have all of the unattached EIPs, will first check for number of them, if 0 will return and exit the function as there is no need to notify the subscribers of SNS if there is nothing to worry about. Else, construct a payload string. The `NetworkBorderGroup` of a specific EIP specifies the region the IP was acquired in.
``` javascript
let message = [];
    if (unattachedEIPs.length === 0)
        return;
    
message.push("List of unattached EIPs: \n");
    for (const eipWithRegion of unattachedEIPs){
        message.push(`Region: ${eipWithRegion.NetworkBorderGroup} EIP: 			${eipWithRegion.PublicIp}\n`);
    }
const payload = message.join("");
console.log(`Payload:\n ${payload}`);
```

Now that the paylod is constructed, will notify the SNS topic using the SNS client, linking to the specific ARN topic of mine which is an **anti-attern** because I hardcoded the string but you could always include it as an environment variable or using any other means such as [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) which is the recommended AWS way to store often changing/anti-hardcoded parameters which comes with free 4000 parameters to be stored.
```
await snsClient.publish({
        TopicArn: "arn:aws:sns:ap-southeast2:472971161478:EIPCheckNotifier",
        Message: payload,
    }).promise();
console.log("Published to topic");
    
return {
	statusCode: 200
};
```

Now that the code is done, the solution is very easy. All of the API calls to AWS are documented on the following link by AWS: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/index.html

The entire code of the function is on GitHub:
https://github.com/Morr0/EIPCheckNotifier/blob/main/index.js

## Step 6: create the scheduler using Amazon EventBridge
Navigating to EventBridge, creating a new rule to run on a fixed schedule. I chose every 24 hours.

![Step 6](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/6.PNG)

Then integrating with the lambda function as a target. Note that you can integrate with other AWS services as well and have more than one target:

![Step 6b](https://blog-static-files-atheer.s3-ap-southeast-2.amazonaws.com/7.PNG)

## Second thoughts on the design and potential improvements:
Although this is one way of doing what I sought out to do, it is not the only way. I did not check for errors, maybe one of the API calls failed, you could always attach a try-catch block along the way and implement retry logic. I kept the solution simple enough.

Lambda is the best way to achieve this kind of thing on AWS in my opinion, because it is billed on time of execution and GBs of memory used. Which in this case is negligable.

The Lambda uses the Internet to communicate with other AWS services, placing the lambda in a VPC will allow the lambda to use the AWS backbone and communicate with resources using VPC endpoints, this will also introduce complexity limiting what VPCs/regions can be accessed. If you are into this type of thing, then maybe this is a way I encourage you to delve into for complete security within the AWS ecosystem.

This entire system can be automated using [AWS Cloudformation](https://aws.amazon.com/cloudformation/) or even using [Terraform](https://www.terraform.io/).

## Conclusion:
This was an interesting little task showing a coordinated use of various AWS services. SNS was used to send out notificiations to subscribers who in this case maybe a cloud engineer. Lambda was used to do the computation part. EventBridge was the event starter.