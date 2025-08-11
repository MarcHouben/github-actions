const core = require('@actions/core');
// const github = require('@actions/github');
const exec = require('@actions/exec');

async function run() {
  //core.notice('Hello from my custom JavaScript Action!');

  // 1) Get some input values
  // These are defined in action.yml
  const bucket = core.getInput('bucket', { required: true });
  const bucketRegion = core.getInput('bucket-region', { required: true });
  const distFolder = core.getInput('dist-folder', { required: true });

  //github.context.action

  // 2) Upload files
  const s3Uri = `s3://${bucket}`;
  
  // Configure bucket for static website hosting
  await exec.exec(`aws s3 website ${s3Uri} --index-document index.html --error-document index.html --region ${bucketRegion}`);
  
  // Set bucket policy for public read access
  const bucketPolicy = {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PublicReadGetObject",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": `arn:aws:s3:::${bucket}/*`
      }
    ]
  };
  
  // Write policy to temporary file and apply it
  require('fs').writeFileSync('/tmp/bucket-policy.json', JSON.stringify(bucketPolicy, null, 2));
  await exec.exec(`aws s3api put-bucket-policy --bucket ${bucket} --policy file:///tmp/bucket-policy.json --region ${bucketRegion}`);
  
  // Disable block public access settings (only for bucket policy, not ACLs)
  await exec.exec(`aws s3api put-public-access-block --bucket ${bucket} --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false" --region ${bucketRegion}`);
  
  // Upload files without ACL (bucket policy handles public access)
  await exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion} --delete`);

  const websiteUrl = `http://${bucket}.s3-website-${bucketRegion}.amazonaws.com`;
  core.setOutput('website-url', websiteUrl);
}

run().catch(err => {
  core.setFailed(err.message);
});
