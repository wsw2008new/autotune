require 'test_helper'

# Tesing the Blueprint model
class Autotune::BlueprintTest < ActiveSupport::TestCase
  fixtures 'autotune/blueprints'
  setup do
    autotune_blueprints(:example).destroy
  end

  test 'creating blueprints' do
    assert_raises ActiveRecord::RecordInvalid do
      Autotune::Blueprint.create!(:title => 'new blueprint')
    end
    b = Autotune::Blueprint.create!(
      :title => 'new blueprint',
      :repo_url => repo_url)
    assert_equal b.status, 'new'
    assert_equal b.slug, 'new-blueprint'
  end

  test "that slugs don't change" do
    b = Autotune::Blueprint.create!(
      :title => 'new blueprint',
      :repo_url => repo_url)
    assert_equal b.slug, 'new-blueprint'
    b.title = 'updated blueprint'
    b.save!
    b.reload
    assert_equal b.slug, 'new-blueprint'
  end

  test 'custom slugs' do
    b = Autotune::Blueprint.create!(
      :title => 'new blueprint',
      :repo_url => repo_url,
      :slug => 'foobar')
    assert_equal b.slug, 'foobar'
  end

  test 'automatic slugs are unique' do
    b = Autotune::Blueprint.create!(
      :title => 'new blueprint',
      :repo_url => repo_url)
    assert_equal b.slug, 'new-blueprint'

    b = Autotune::Blueprint.create!(
      :title => 'new blueprint',
      :repo_url => repo_url + '#1')
    assert_equal b.slug, 'new-blueprint-1'
  end
end