// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
	"github.com/the-open-agent/openagent/i18n"
)

type AliyunOssStorageProvider struct {
	client    *oss.Client
	bucket    string
	endpoint  string
	cdnDomain string
}

func getOssBucket(bucket string) string {
	bucket = strings.ToLower(strings.TrimSpace(bucket))
	if i := strings.Index(bucket, "://"); i != -1 {
		bucket = bucket[i+3:]
	}
	bucket = strings.Trim(bucket, "/")
	if i := strings.Index(bucket, "."); i != -1 {
		bucket = bucket[:i]
	}
	return bucket
}

func getOssEndpoint(endpoint string, bucket string) string {
	endpoint = strings.ToLower(strings.TrimSpace(endpoint))
	scheme := ""
	if i := strings.Index(endpoint, "://"); i != -1 {
		scheme = endpoint[:i+3]
		endpoint = endpoint[i+3:]
	}
	endpoint = strings.Trim(endpoint, "/")
	if bucket != "" {
		endpoint = strings.TrimPrefix(endpoint, bucket+".")
	}
	if endpoint == "" {
		return ""
	}
	return scheme + endpoint
}

func getOssRegion(endpoint string) string {
	host := endpoint
	if i := strings.Index(host, "://"); i != -1 {
		host = host[i+3:]
	}
	host = strings.Trim(host, "/")
	if !strings.HasSuffix(host, ".aliyuncs.com") {
		return ""
	}

	host = strings.TrimSuffix(host, ".aliyuncs.com")
	host = strings.TrimSuffix(host, "-internal")
	if !strings.HasPrefix(host, "oss-") || strings.Contains(host, ".") {
		return ""
	}

	return strings.TrimPrefix(host, "oss-")
}

func NewAliyunOssStorageProvider(accessKeyId string, accessKeySecret string, region string, bucket string, endpoint string, cdnDomain string, providerName string, lang string) (*AliyunOssStorageProvider, error) {
	bucket = getOssBucket(bucket)
	if bucket == "" {
		return nil, fmt.Errorf(i18n.Translate(lang, "storage:The bucket for the storage provider: %s should not be empty"), providerName)
	}
	if !oss.IsValidBucketName(oss.Ptr(bucket)) {
		return nil, fmt.Errorf(i18n.Translate(lang, "storage:The bucket: %s for the storage provider: %s is invalid, it should be 3 to 63 characters long and can only contain lowercase letters, digits and hyphens"), bucket, providerName)
	}

	endpoint = getOssEndpoint(endpoint, bucket)
	region = strings.ToLower(strings.TrimSpace(region))
	if region == "" {
		region = getOssRegion(endpoint)
	}
	if endpoint == "" && region == "" {
		return nil, fmt.Errorf(i18n.Translate(lang, "storage:The endpoint and the region for the storage provider: %s should not be both empty"), providerName)
	}
	if endpoint == "" {
		endpoint = fmt.Sprintf("oss-%s.aliyuncs.com", region)
	}

	cfg := oss.LoadDefaultConfig().
		WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyId, accessKeySecret, "")).
		WithRegion(region).
		WithEndpoint(endpoint)

	client := oss.NewClient(cfg)
	return &AliyunOssStorageProvider{
		client:    client,
		bucket:    bucket,
		endpoint:  endpoint,
		cdnDomain: cdnDomain,
	}, nil
}

func (p *AliyunOssStorageProvider) getObjectUrl(key string) string {
	if p.cdnDomain != "" {
		domain := p.cdnDomain
		if !strings.HasPrefix(domain, "http") {
			domain = "https://" + domain
		}
		domain = strings.TrimRight(domain, "/")
		return fmt.Sprintf("%s/%s", domain, key)
	}
	endpoint := p.endpoint
	if !strings.HasPrefix(endpoint, "http") {
		endpoint = "https://" + endpoint
	}
	endpoint = strings.TrimRight(endpoint, "/")
	return fmt.Sprintf("%s/%s/%s", endpoint, p.bucket, key)
}

func (p *AliyunOssStorageProvider) ListObjects(prefix string) ([]*Object, error) {
	result, err := p.client.ListObjectsV2(context.TODO(), &oss.ListObjectsV2Request{
		Bucket: oss.Ptr(p.bucket),
		Prefix: oss.Ptr(prefix),
	})
	if err != nil {
		return nil, err
	}

	var objects []*Object
	for _, obj := range result.Contents {
		key := oss.ToString(obj.Key)
		size := obj.Size
		lastModified := ""
		if obj.LastModified != nil {
			lastModified = obj.LastModified.Format(time.RFC3339)
		}
		objects = append(objects, &Object{
			Key:          key,
			LastModified: lastModified,
			Size:         size,
			Url:          p.getObjectUrl(key),
		})
	}
	return objects, nil
}

func (p *AliyunOssStorageProvider) PutObject(user string, parent string, key string, fileBuffer *bytes.Buffer) (string, error) {
	_, err := p.client.PutObject(context.TODO(), &oss.PutObjectRequest{
		Bucket: oss.Ptr(p.bucket),
		Key:    oss.Ptr(key),
		Body:   fileBuffer,
	})
	if err != nil {
		return "", err
	}
	return p.getObjectUrl(key), nil
}

func (p *AliyunOssStorageProvider) DeleteObject(key string) error {
	_, err := p.client.DeleteObject(context.TODO(), &oss.DeleteObjectRequest{
		Bucket: oss.Ptr(p.bucket),
		Key:    oss.Ptr(key),
	})
	return err
}
